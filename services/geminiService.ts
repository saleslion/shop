
// No direct GoogleGenAI import or API_KEY needed here anymore.
// Types are still useful for frontend state if needed elsewhere, but not for AI context directly.
// import { ShopifyArticleContextInfo, ShopifyCategory, ShopifyProductContextInfo } from '../types';


// Interface for the simplified data sent to the new backend for initialization.
interface InitializeChatPayload {
  storeName: string;
  storeDomain: string;
  // No more full product/article lists here
}

interface InitializeChatResponse {
  text: string; // Welcome message from AI
  sessionId: string; // Session ID from backend
}

export const initializeChatSession = async (initPayload: InitializeChatPayload): Promise<InitializeChatResponse> => {
  try {
    const response = await fetch('/api/chat', { // Calls your Vercel serverless function
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'initialize',
        payload: initPayload, // Send simplified payload
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to initialize chat session with backend." }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    const data: InitializeChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error initializing chat session via backend (v2):", error);
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
        payload: { userMessage, sessionId }, // This payload remains the same
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to send message to backend."}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error sending chat message via backend (v2):", error);
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
    console.log("Chat session_v2 ended signal sent to backend for session:", sessionId);
  } catch (error) {
    console.error("Error sending end chat session_v2 signal to backend:", error);
  }
};
