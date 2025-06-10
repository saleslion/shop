
import { ShopifyArticleContextInfo, ShopifyCategory, ShopifyProductContextInfo } from '../types';

// No direct GoogleGenAI import or API_KEY needed here anymore.

// Helper to extract plain text from HTML (very basic) - this can be removed if not used by context prep in App.tsx
// const stripHtml = (html: string | null | undefined): string => {
//   if (!html) return '';
//   const doc = new DOMParser().parseFromString(html, 'text/html');
//   return doc.body.textContent || "";
// };

interface ShopifyStoreContext {
  storeName: string | null;
  categories: ShopifyCategory[];
  articles: ShopifyArticleContextInfo[];
  products: ShopifyProductContextInfo[]; 
}

interface InitializeChatResponse {
  text: string; // Welcome message from AI
  sessionId: string; // Session ID from backend
}

export const initializeChatSession = async (storeContext: ShopifyStoreContext, storeDomain: string): Promise<InitializeChatResponse> => {
  try {
    const response = await fetch('/api/chat', { // Calls your Vercel serverless function
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'initialize',
        payload: { storeContext, storeDomain },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to initialize chat session with backend." }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    const data: InitializeChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error initializing chat session via backend:", error);
    throw error; // Re-throw to be caught by App.tsx
  }
};

export const sendChatMessage = async (userMessage: string, sessionId: string): Promise<string> => {
   if (!sessionId) {
    throw new Error("Chat session ID is missing.");
  }
  try {
    const response = await fetch('/api/chat', { // Calls your Vercel serverless function
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendMessage',
        payload: { userMessage, sessionId },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to send message to backend."}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error sending chat message via backend:", error);
    throw error; // Re-throw
  }
};

export const endChatSession = async (sessionId: string | null) => {
  if (!sessionId) return;
  try {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'endSession', payload: { sessionId } })
    });
    console.log("Chat session ended signal sent to backend for session:", sessionId);
  } catch (error) {
    console.error("Error sending end chat session signal to backend:", error);
  }
};
