
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShopifyProduct, ShopifyArticle, ShopifyCategory, ChatMessage, ShopifyArticleContextInfo, ShopifyProductContextInfo } from './types';
import { MOCK_SHOPIFY_PRODUCTS, MOCK_SHOPIFY_ARTICLES } from './constants'; 
import { initializeChatSession, sendChatMessage, endChatSession } from './services/geminiService';

import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import { FiMessageSquare, FiX } from 'react-icons/fi';

const SHOPIFY_API_VERSION = '2024-04'; 
const HIFISTI_STORE_DOMAIN = 'hifisti.myshopify.com';
// Read from Vite environment variables (set in Vercel UI and .env.local for local dev)
const HIFISTI_STOREFRONT_API_TOKEN = import.meta.env.VITE_HIFISTI_STOREFRONT_API_TOKEN;

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const App: React.FC = () => {
  const [storeDisplayName, setStoreDisplayName] = useState<string>("Hifisti");
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  
  const [storeCategories, setStoreCategories] = useState<ShopifyCategory[]>([]);
  const [storeArticles, setStoreArticles] = useState<ShopifyArticleContextInfo[]>([]);
  const [storeProductsContext, setStoreProductsContext] = useState<ShopifyProductContextInfo[]>([]);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiResponding, setIsAiResponding] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [chatInitialized, setChatInitialized] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);


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

  const prepareArticleContext = (articles: ShopifyArticle[]): ShopifyArticleContextInfo[] => {
    return articles.map(article => ({
      id: article.id,
      handle: article.handle,
      title: article.title,
      excerpt: stripHtml(article.excerpt_html || article.body_html).substring(0, 200) + '...',
      tags: article.tags || [],
    }));
  };

  const prepareProductContext = (products: ShopifyProduct[]): ShopifyProductContextInfo[] => {
    return products.map(product => {
      const plainDescription = stripHtml(product.body_html);
      let shortDesc = plainDescription.substring(0, 100);
      if (plainDescription.length > 100) shortDesc += "...";
      if (!shortDesc && product.tags.length > 0) {
        shortDesc = "Key features include: " + product.tags.slice(0, 3).join(', ') + ".";
      }
      return {
        id: product.id, handle: product.handle, title: product.title,
        product_type: product.product_type || "General", tags: product.tags || [],
        short_description: shortDesc,
      };
    });
  };

  const fetchProductsAndArticlesFromShopify = useCallback(async (): Promise<{ products: ShopifyProduct[], articles: ShopifyArticle[] }> => {
    if (!HIFISTI_STOREFRONT_API_TOKEN) { // Check if token is loaded from env
        throw new Error("Storefront API token for Hifisti is not configured. Please set VITE_HIFISTI_STOREFRONT_API_TOKEN environment variable.");
    }
    const endpoint = `https://${HIFISTI_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': HIFISTI_STOREFRONT_API_TOKEN,
    };
    
    console.log(`[Shopify API Call] Preparing to fetch data for Hifisti...`);
    
    const productQuery = `
      query GetProducts { products(first: 75, sortKey: PRODUCT_TYPE) { edges { node { id handle title descriptionHtml vendor productType tags images(first: 1) { edges { node { src altText } } } } } } }`;
    const articleQuery = `
      query GetArticles { articles(first: 50, sortKey: TITLE) { edges { node { id handle title contentHtml excerptHtml blog { title } authorV2 { name } tags image { src altText } } } } }`;
    
    try {
      const [productResponse, articleResponse] = await Promise.all([
        fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: productQuery }) }),
        fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: articleQuery }) })
      ]);

      if (!productResponse.ok || !articleResponse.ok) {
        let errorMsg = "Failed to fetch data from Shopify for Hifisti.";
        if (productResponse.status === 401 || articleResponse.status === 401) {
             errorMsg = "Unauthorized: Invalid Shopify Storefront API Access Token for Hifisti. Please check the token and ensure it has correct permissions (read products & articles).";
        }
        throw new Error(errorMsg);
      }
      const productJson: any = await productResponse.json();
      const articleJson: any = await articleResponse.json();

      if (productJson.errors || articleJson.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(productJson.errors || articleJson.errors)}`);
      }
      const fetchedProducts: ShopifyProduct[] = (productJson.data?.products?.edges || []).map((edge: any) => ({
        id: edge.node.id, handle: edge.node.handle, title: edge.node.title, body_html: edge.node.descriptionHtml, vendor: edge.node.vendor, product_type: edge.node.productType, tags: edge.node.tags || [], images: (edge.node.images?.edges || []).map((imgEdge: any) => ({ src: imgEdge.node.src, altText: imgEdge.node.altText })),
      }));
      const fetchedArticles: ShopifyArticle[] = (articleJson.data?.articles?.edges || []).map((edge: any) => ({
        id: edge.node.id, handle: edge.node.handle, title: edge.node.title, body_html: edge.node.contentHtml, excerpt_html: edge.node.excerptHtml, blog_title: edge.node.blog?.title || "Blog", author_name: edge.node.authorV2?.name || "Unknown Author", tags: edge.node.tags || [], image: edge.node.image ? { src: edge.node.image.src, altText: edge.node.image.altText } : null,
      }));
      return { products: fetchedProducts, articles: fetchedArticles };
    } catch (error) {
        console.error("[Hifisti Shopify API Call] Error:", error);
        throw error; 
    }
  }, []);

  const initializeAppForHifisti = useCallback(async () => {
    setAppError(null);
    setIsLoadingData(true);
    setChatMessages([]);
    setChatInitialized(false);
    
    try {
      const { products: liveProducts, articles: liveArticles } = await fetchProductsAndArticlesFromShopify();
      
      const derivedCats = deriveCategoriesFromProducts(liveProducts);
      const preparedArticlesCtx = prepareArticleContext(liveArticles);
      const preparedProductsCtx = prepareProductContext(liveProducts);

      setStoreCategories(derivedCats);
      setStoreArticles(preparedArticlesCtx);
      setStoreProductsContext(preparedProductsCtx);

      const fallbackCategories = deriveCategoriesFromProducts(MOCK_SHOPIFY_PRODUCTS);
      const fallbackArticlesCtx = prepareArticleContext(MOCK_SHOPIFY_ARTICLES);
      const fallbackProductsCtx = prepareProductContext(MOCK_SHOPIFY_PRODUCTS);

      if (liveProducts.length === 0 && liveArticles.length === 0) {
        setStoreCategories(fallbackCategories);
        setStoreArticles(fallbackArticlesCtx);
        setStoreProductsContext(fallbackProductsCtx);
        setAppError("Connected to Hifisti, but no products or articles found. Displaying sample context for AI. Check Hifisti's catalog, blog, or API permissions.");
      }
      
      setIsAiResponding(true); 
      const initResponse = await initializeChatSession({
          storeName: "Hifisti",
          categories: derivedCats.length > 0 ? derivedCats : fallbackCategories, 
          articles: preparedArticlesCtx.length > 0 ? preparedArticlesCtx : fallbackArticlesCtx,
          products: preparedProductsCtx.length > 0 ? preparedProductsCtx : fallbackProductsCtx,
      }, HIFISTI_STORE_DOMAIN );
      
      setChatMessages([{ id: Date.now().toString(), sender: 'ai', text: initResponse.text, timestamp: new Date() }]);
      setCurrentSessionId(initResponse.sessionId); // Store session ID
      setChatInitialized(true);

    } catch (err) {
      if (err instanceof Error) setAppError(err.message);
      else setAppError("An unknown error occurred while connecting to Hifisti Shopify store.");
      // endChatSession will be called via backend if needed or on component unmount
    } finally {
      setIsLoadingData(false);
      setIsAiResponding(false);
    }
  }, [fetchProductsAndArticlesFromShopify]);

  useEffect(() => {
    initializeAppForHifisti();
    
    // Optional: Call endChatSession on backend when window is closed/unloaded
    const handleBeforeUnload = () => {
      if (currentSessionId) {
        endChatSession(currentSessionId); // Assuming endChatSession can take a sessionId
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (currentSessionId) {
        endChatSession(currentSessionId); // End session on unmount
      }
    }
  }, [initializeAppForHifisti, currentSessionId]);


  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !chatInitialized || !currentSessionId) return;

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`, sender: 'user', text: messageText, timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newUserMessage]);
    setIsAiResponding(true);
    setAppError(null);

    try {
      const aiResponseText = await sendChatMessage(messageText, currentSessionId);
      const newAiMessage: ChatMessage = {
        id: `ai-${Date.now()}`, sender: 'ai', text: aiResponseText, timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, newAiMessage]);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "Failed to get response from AI.";
      const errorAiMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`, sender: 'ai',
        text: `Sorry, I encountered an error: ${errorText}. Please try again later.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorAiMessage]);
    } finally {
      setIsAiResponding(false);
    }
  };
  
  const toggleChat = () => setIsChatOpen(prev => !prev);

  if (isLoadingData && !appError) {
    return (
      <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col justify-center items-center z-50">
        <div className="inline-block"><LoadingSpinner /></div>
        <p className="text-sky-400 mt-4 text-lg">Connecting to Hifisti & preparing AI Advisor...</p>
      </div>
    );
  }

  if (appError && (!chatInitialized || !HIFISTI_STOREFRONT_API_TOKEN)) {
     return (
        <div className="fixed inset-0 bg-slate-900 flex flex-col justify-center items-center p-8 z-40">
            <div className="max-w-md w-full">
                <Header /> 
                <div className="mt-8">
                    <ErrorMessage message={`${appError} Please ensure the VITE_HIFISTI_STOREFRONT_API_TOKEN environment variable is correctly set.`} />
                </div>
                 <footer className="text-center p-4 text-slate-500 text-sm mt-8">
                    <p>&copy; {new Date().getFullYear()} Hifisti AI Product Advisor. Powered by Gemini.</p>
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
            <ChatInterface
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isAiResponding={isAiResponding}
              storeDisplayName={storeDisplayName}
            />
          </main>
          {appError && chatInitialized && ( 
             <div className="p-2 border-t border-slate-700">
                <p className="text-xs text-red-400 text-center">{appError}</p>
             </div>
          )}
           <footer className="text-center py-2 px-4 bg-slate-950 text-slate-600 text-xs border-t border-slate-700">
            Hifisti AI Advisor
          </footer>
        </div>
      )}
    </>
  );
};

export default App;
