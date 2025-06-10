
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShopifyProduct, ShopifyArticle, ShopifyCategory, ChatMessage, ShopifyArticleContextInfo, ShopifyProductContextInfo } from './types'; // Assuming types.ts is in the root
import { MOCK_SHOPIFY_PRODUCTS, MOCK_SHOPIFY_ARTICLES } from './constants'; // Assuming constants.ts is in the root
import { initializeChatSession, sendChatMessage, endChatSession } from './services/geminiService'; // Assuming services/geminiService.ts

import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import { FiMessageSquare, FiX } from 'react-icons/fi';

const SHOPIFY_API_VERSION = '2024-04';
const HIFISTI_STORE_DOMAIN = 'hifisti.myshopify.com';

const HIFISTI_STOREFRONT_API_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_HIFISTI_STOREFRONT_API_TOKEN
  : undefined;

// Helper to strip HTML (remains useful for preparing display data)
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const App: React.FC = () => {
  const [storeDisplayName, setStoreDisplayName] = useState<string>("Hifisti");
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isLoadingShopifyData, setIsLoadingShopifyData] = useState<boolean>(true); // For Shopify data, not AI init

  // These states are for local display/selection, not directly for AI context anymore
  const [storeCategories, setStoreCategories] = useState<ShopifyCategory[]>([]);
  // const [storeArticlesForDisplay, setStoreArticlesForDisplay] = useState<ShopifyArticle[]>([]);
  // const [storeProductsForDisplay, setStoreProductsForDisplay] = useState<ShopifyProduct[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiResponding, setIsAiResponding] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [chatInitialized, setChatInitialized] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const currentSessionIdRef = useRef<string | null>(null);
  const appInitializedRef = useRef<boolean>(false); // For the entire app's one-time setup

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const deriveCategoriesFromProducts = (products: ShopifyProduct[]): ShopifyCategory[] => {
    const productTypesMap = new Map<string, number>();
    products.forEach(product => {
      const type = product.product_type || "Uncategorized";
      productTypesMap.set(type, (productTypesMap.get(type) || 0) + 1);
    });
    return Array.from(productTypesMap.entries()).map(([name, count]) => ({
      name,
      productCount: count,
    })).sort((a, b) => a.name.localeCompare(b.name));
  };
  
  // This function is still useful if you want to display products/articles in the UI
  // or use them for some other client-side logic, but NOT for AI initial context.
  const fetchAndPrepareShopifyDataForDisplay = useCallback(async () => {
    if (!HIFISTI_STOREFRONT_API_TOKEN) {
      throw new Error("Storefront API token for Hifisti is not configured. Please set the VITE_HIFISTI_STOREFRONT_API_TOKEN environment variable.");
    }
    const endpoint = `https://${HIFISTI_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': HIFISTI_STOREFRONT_API_TOKEN,
    };
    console.log(`[Shopify API Call] Preparing to fetch data for ${HIFISTI_STORE_DOMAIN} (for UI display)...`);
    const productQuery = `
      query GetProducts { products(first: 20, sortKey: PRODUCT_TYPE) { edges { node { id handle title descriptionHtml vendor productType tags images(first: 1) { edges { node { src altText } } } } } } }`;
    // Article query can be added if needed for UI display
    try {
      const productResponse = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: productQuery }) });
      if (!productResponse.ok) {
        let errorMsg = "Failed to fetch product data from Shopify for Hifisti.";
        if (productResponse.status === 401 ) {
             errorMsg = "Unauthorized: Invalid Shopify Storefront API Access Token for Hifisti. Please check VITE_HIFISTI_STOREFRONT_API_TOKEN.";
        }
        throw new Error(errorMsg);
      }
      const productJson: any = await productResponse.json();
      if (productJson.errors) throw new Error(`GraphQL errors: ${JSON.stringify(productJson.errors)}`);
      
      const fetchedProducts: ShopifyProduct[] = (productJson.data?.products?.edges || []).map((edge: any) => ({
        id: edge.node.id, handle: edge.node.handle, title: edge.node.title, body_html: edge.node.descriptionHtml, vendor: edge.node.vendor, product_type: edge.node.productType, tags: edge.node.tags || [], images: (edge.node.images?.edges || []).map((imgEdge: any) => ({ src: imgEdge.node.src, altText: imgEdge.node.altText })),
      }));
      
      setStoreCategories(deriveCategoriesFromProducts(fetchedProducts.length > 0 ? fetchedProducts : MOCK_SHOPIFY_PRODUCTS));
      // Set other states like setStoreProductsForDisplay(fetchedProducts) if needed for UI
      if (fetchedProducts.length === 0) {
        setAppError("Fetched from Shopify, but no products found. Displaying sample categories if any.");
      }

    } catch (error) {
        console.error("[Hifisti Shopify API Call for Display] Error:", error);
        setStoreCategories(deriveCategoriesFromProducts(MOCK_SHOPIFY_PRODUCTS)); // Fallback categories for UI
        throw error; // Rethrow to be caught by initializeApp
    }
  }, []);


  const initializeApp = useCallback(async () => {
    setAppError(null);
    setIsLoadingShopifyData(true); // For Shopify data part
    setChatMessages([]);
    setChatInitialized(false);

    try {
      // Step 1: Fetch Shopify data for UI display (categories, product lists etc.)
      // This is now separate from AI context priming.
      await fetchAndPrepareShopifyDataForDisplay();
      // If successful, storeDisplayName can be set based on actual connection
      setStoreDisplayName("Hifisti"); 

    } catch (err) {
      // Handle Shopify data fetching errors - display these in UI but still try to init chat
      if (err instanceof Error) setAppError(`Shopify Connect Error: ${err.message}. AI Advisor might have limited knowledge.`);
      else setAppError("Unknown error connecting to Shopify. AI Advisor might have limited knowledge.");
      setStoreDisplayName("Hifisti (Offline)"); // Indicate potential issue
    } finally {
      setIsLoadingShopifyData(false);
    }

    // Step 2: Initialize chat session with the backend (RAG version)
    // This happens regardless of Shopify data fetching success, as AI might work with Supabase data.
    try {
        setIsAiResponding(true); // AI is "responding" by initializing
        const initResponse = await initializeChatSession({
            storeName: "Hifisti", // Keep it simple, backend knows context
            storeDomain: HIFISTI_STORE_DOMAIN,
        });

        setChatMessages([{ id: Date.now().toString(), sender: 'ai', text: initResponse.text, timestamp: new Date() }]);
        setCurrentSessionId(initResponse.sessionId);
        setChatInitialized(true);
        // Clear any previous Shopify-related appError if chat init is successful
        if(appError && appError.startsWith("Shopify Connect Error")){
           // Keep the Shopify error for info, but main app is now chat-ready
           setAppError(appError + " Chat AI is active.");
        } else {
           setAppError(null); // Clear general errors if chat is fine
        }
    } catch (chatErr) {
        if (chatErr instanceof Error) setAppError(prevError => `${prevError ? prevError + " " : ""}Chat AI Init Error: ${chatErr.message}`);
        else setAppError(prevError => `${prevError ? prevError + " " : ""}Unknown error initializing Chat AI.`);
        setChatInitialized(false); // Explicitly set chat as not initialized on error
    } finally {
        setIsAiResponding(false);
    }
  }, [fetchAndPrepareShopifyDataForDisplay, appError]); // appError added to allow clearing it

  useEffect(() => {
    if (appInitializedRef.current) return;
    appInitializedRef.current = true;
    
    initializeApp();

    const handleBeforeUnload = () => {
      if (currentSessionIdRef.current) endChatSession(currentSessionIdRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (currentSessionIdRef.current) endChatSession(currentSessionIdRef.current);
    };
  }, [initializeApp]);


  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !chatInitialized || !currentSessionId) {
        setAppError("Chat not ready or session ID missing. Please wait or refresh.");
        return;
    }

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`, sender: 'user', text: messageText, timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newUserMessage]);
    setIsAiResponding(true);
    // Optimistically clear non-critical app errors when user sends a message
    if(appError && !appError.toLowerCase().includes("token")) setAppError(null);


    try {
      const aiResponseText = await sendChatMessage(messageText, currentSessionId);
      const newAiMessage: ChatMessage = {
        id: `ai-${Date.now()}`, sender: 'ai', text: aiResponseText, timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, newAiMessage]);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "Failed to get response from AI.";
      setAppError(`AI Error: ${errorText}`); // Show error more prominently if send fails
      const errorAiMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`, sender: 'ai',
        text: `Sorry, I encountered an error: ${errorText}. Please try again.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorAiMessage]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const toggleChat = () => setIsChatOpen(prev => !prev);

  // Initial loading screen for Shopify data (quick)
  if (isLoadingShopifyData && !appInitializedRef.current) {
    return (
      <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col justify-center items-center z-50">
        <div className="inline-block"><LoadingSpinner /></div>
        <p className="text-sky-400 mt-4 text-lg">Connecting to {HIFISTI_STORE_DOMAIN}...</p>
      </div>
    );
  }
  
  // Critical error screen (e.g. missing token, or chat completely failed to init)
  if ((appError && (!chatInitialized || HIFISTI_STOREFRONT_API_TOKEN === undefined)) ) {
     return (
        <div className="fixed inset-0 bg-slate-900 flex flex-col justify-center items-center p-8 z-40">
            <div className="max-w-md w-full">
                <Header />
                <div className="mt-8">
                    <ErrorMessage message={`${appError}${HIFISTI_STOREFRONT_API_TOKEN === undefined ? " Please ensure the VITE_HIFISTI_STOREFRONT_API_TOKEN environment variable is correctly set and accessible." : ""}`} />
                </div>
                 <footer className="text-center p-4 text-slate-500 text-sm mt-8">
                    <p>&copy; {new Date().getFullYear()} {storeDisplayName} AI Product Advisor. Powered by Gemini & Supabase.</p>
                </footer>
            </div>
        </div>
     );
  }

  return (
    <>
      <button
        onClick={toggleChat}
        className="fixed bottom-5 right-5 bg-sky-500 hover:bg-sky-600 text-white p-4 rounded-full shadow-xl z-[1001] transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        aria-label={isChatOpen ? "Close AI Advisor Chat" : "Open AI Advisor Chat"}
      >
        {isChatOpen ? <FiX size={28} /> : <FiMessageSquare size={28} />}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-20 right-5 w-[calc(100%-40px)] max-w-md h-[calc(100%-100px)] max-h-[650px] bg-slate-900 flex flex-col shadow-2xl rounded-xl z-[1000] border border-slate-700 overflow-hidden">
          <Header />
          <main className="flex-grow flex flex-col p-0 overflow-hidden">
            {isAiResponding && chatMessages.length === 0 && !appError && ( // Initial AI loading for chat
                <div className="flex-grow flex flex-col justify-center items-center">
                    <LoadingSpinner />
                    <p className="text-slate-400 mt-2">AI Advisor is waking up...</p>
                </div>
            )}
            {(!isAiResponding || chatMessages.length > 0 || appError) && ( // Show chat interface once messages exist or error or not loading
              <ChatInterface
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                isAiResponding={isAiResponding && chatMessages[chatMessages.length-1]?.sender === 'user'} // Show typing if user just sent
                storeDisplayName={storeDisplayName}
              />
            )}
          </main>
          {appError && ( // Show errors at the bottom if chat is active
             <div className="p-2 border-t border-slate-700 bg-slate-850">
                <p className="text-xs text-red-400 text-center">{appError}</p>
             </div>
          )}
           <footer className="text-center py-2 px-4 bg-slate-950 text-slate-600 text-xs border-t border-slate-700">
            {storeDisplayName} AI Advisor. Powered by Gemini & Supabase.
          </footer>
        </div>
      )}
    </>
  );
};

export default App;
