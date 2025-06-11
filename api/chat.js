
// File: api/chat.js
// This file should be in the 'api' folder at the root of your Vercel project.

import { GoogleGenAI } from '@google/genai'; // Chat type is not directly used here for instantiation
import { createClient } from '@supabase/supabase-js';

// --- Environment Variables ---
console.log("[API_CHAT_INIT] Reading environment variables...");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMBEDDING_MODEL_NAME = 'text-embedding-004';

// --- Sanity check for environment variables ---
if (!GEMINI_API_KEY) {
  console.error("CRITICAL_SERVER_ERROR: GEMINI_API_KEY environment variable is MISSING.");
} else {
  console.log("[API_CHAT_INIT] GEMINI_API_KEY: Loaded (length hidden for security)");
}
if (!SUPABASE_URL) {
  console.error("CRITICAL_SERVER_ERROR: SUPABASE_URL environment variable is MISSING.");
} else {
  console.log("[API_CHAT_INIT] SUPABASE_URL: Loaded");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL_SERVER_ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is MISSING.");
} else {
  console.log("[API_CHAT_INIT] SUPABASE_SERVICE_ROLE_KEY: Loaded (length hidden for security)");
}

// --- Initialize Google AI Client ---
let ai;
if (GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log("[API_CHAT_INIT] GoogleGenAI client initialized successfully.");
  } catch (e) {
    console.error("[API_CHAT_INIT] CRITICAL_ERROR initializing GoogleGenAI client:", e.message, e.stack);
    // If AI client fails, the handler will still proceed but AI operations will fail.
    // The main handler check for GEMINI_API_KEY will catch this.
  }
} else {
    console.error("[API_CHAT_INIT] GoogleGenAI client NOT initialized due to missing API key.");
}

// --- Initialize Supabase Client ---
let supabase;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    console.log("[API_CHAT_INIT] Supabase client initialized successfully.");
  } catch (e) {
    console.error("[API_CHAT_INIT] CRITICAL_ERROR initializing Supabase client:", e.message, e.stack);
  }
} else {
    console.error("[API_CHAT_INIT] Supabase client NOT initialized due to missing URL or Key.");
}

// Simple in-memory store for server-side chat sessions (Gemini Chat objects & history)
let serverSideChatSessions = {}; // sessionId -> { chatInstance: Chat, history: Message[] }

// --- Helper Functions ---
async function getEmbedding(textForEmbedding) {
  console.log(`[GET_EMBEDDING] Attempting to generate embedding for text (first 50 chars): "${textForEmbedding.substring(0, 50)}..."`);
  if (!textForEmbedding || typeof textForEmbedding !== 'string' || textForEmbedding.trim() === '') {
    console.warn("[GET_EMBEDDING] Called with invalid text:", textForEmbedding);
    throw new Error("Cannot generate embedding for empty or invalid text.");
  }
  if (!ai) { // Check if AI client was initialized
    console.error("[GET_EMBEDDING] Google AI client not available for embedding.");
    throw new Error("AI client not initialized, cannot generate embedding.");
  }
  try {
    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL_NAME,
        content: { parts: [{ text: textForEmbedding }] }, // Corrected content structure
    });
    if (response && response.embedding && response.embedding.values) {
        console.log(`[GET_EMBEDDING] Embedding generated successfully. Dimension: ${response.embedding.values.length}`);
        return response.embedding.values;
    } else {
        console.error("[GET_EMBEDDING] Invalid embedding response structure:", response);
        throw new Error("Failed to get embedding values from API response.");
    }
  } catch (e) {
    console.error("[GET_EMBEDDING] Error generating embedding:", e.message, e.stack);
    throw new Error(`Failed to generate embedding: ${e.message}`);
  }
}

async function logChatInteraction(sessionId, userQuery, retrievedContextSummary, aiResponse) {
  console.log(`[LOG_INTERACTION] Attempting to log interaction for session: ${sessionId}`);
  if (!supabase) {
    console.error("[LOG_INTERACTION] Supabase client not available. Skipping interaction log.");
    return;
  }
  try {
    const { data, error } = await supabase
      .from('chat_interactions')
      .insert([{ 
        session_id: sessionId, 
        user_query: userQuery, 
        retrieved_context_summary: retrievedContextSummary, 
        ai_response: aiResponse 
      }]);

    if (error) {
      console.error(`[LOG_INTERACTION] Supabase error logging chat interaction for session ${sessionId}:`, error.message, error.details);
    } else {
      console.log(`[LOG_INTERACTION] Chat interaction logged successfully for session ${sessionId}.`);
    }
  } catch (e) {
    console.error(`[LOG_INTERACTION] Exception logging chat interaction for session ${sessionId}:`, e.message, e.stack);
  }
}

// --- Main Handler ---
export default async function handler(req, res) {
  console.log(`[API_HANDLER] Received request. Method: ${req.method}, Action: ${req.body?.action}`);
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.warn(`[API_HANDLER] Method Not Allowed: ${req.method}`);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Double-check critical environment variables for each request, in case of cold start issues.
  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ai || !supabase) {
    console.error("[API_HANDLER] CRITICAL_SERVER_ERROR: Core services (AI/Supabase) or environment variables are not properly initialized.");
    return res.status(500).json({ error: 'AI service or Database configuration error on server. Please check server logs.' });
  }

  const { action, payload } = req.body;
  console.log(`[API_HANDLER] Action: ${action}, Payload received:`, payload ? 'Yes' : 'No');


  try {
    if (action === 'initialize') {
      console.log("[API_HANDLER_INIT] Initializing new chat session...");
      const { storeName, storeDomain } = payload;
      if (!storeName || !storeDomain) {
        console.warn("[API_HANDLER_INIT] Missing storeName or storeDomain in payload.");
        return res.status(400).json({ error: 'Missing storeName or storeDomain for initialization.' });
      }
      console.log(`[API_HANDLER_INIT] storeName: ${storeName}, storeDomain: ${storeDomain}`);

      const newSessionId = `session_v2_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[API_HANDLER_INIT] Generated new sessionId: ${newSessionId}`);

      const systemInstruction = `You are a friendly, expert AI shopping assistant for "${storeName}".
Your primary goal is to help users find products or information within this store using the context I provide.
You will be given relevant product and article snippets based on the user's query from the store's database.
Base your answers primarily on these provided snippets.
If the provided snippets are not relevant or insufficient, clearly state that you couldn't find specific information in the current context. Do not make up information.
When suggesting products or articles from the snippets, always mention their full titles.
Product links should be in the format: https://${storeDomain}/products/{product_handle}
Article links should be in the format: https://${storeDomain}/blogs/{blog_handle}/{article_handle} (assume the blog_handle is 'news' or 'blog' if not specified in the snippet, try 'news' first).
Be helpful, polite, and strictly stick to the information provided.
Start the conversation with a friendly welcome message and ask how you can assist the user with their shopping needs at "${storeName}" today.`;
      
      console.log("[API_HANDLER_INIT] System instruction prepared. Creating Gemini chat instance...");
      const chatInstance = ai.chats.create({ // Use ai.chats.create
        model: GEMINI_MODEL_NAME,
        config: { systemInstruction: systemInstruction },
        // History will be managed explicitly by us
      });
      serverSideChatSessions[newSessionId] = { chatInstance: chatInstance, history: [] }; // Store instance and our history
      console.log(`[API_HANDLER_INIT] Gemini chat instance created and session stored for ${newSessionId}.`);

      console.log(`[API_HANDLER_INIT] Sending initial 'Hello' to Gemini for ${newSessionId} to get welcome message...`);
      const initialUserMessage = "Hello"; // Implicit initial message from user to kickstart
      const geminiResponse = await chatInstance.sendMessage({ message: initialUserMessage });
      const initialAiText = geminiResponse.text;
      console.log(`[API_HANDLER_INIT] Gemini welcome message received for ${newSessionId}: "${initialAiText.substring(0, 100)}..."`);
      
      // Update our explicit history
      serverSideChatSessions[newSessionId].history.push({ role: "user", parts: [{ text: initialUserMessage }] });
      serverSideChatSessions[newSessionId].history.push({ role: "model", parts: [{ text: initialAiText }] });
      console.log(`[API_HANDLER_INIT] History updated for ${newSessionId}. Current length: ${serverSideChatSessions[newSessionId].history.length}`);
      
      // Log this initial interaction
      await logChatInteraction(newSessionId, initialUserMessage, "System-generated welcome", initialAiText);

      return res.status(200).json({
        text: initialAiText,
        sessionId: newSessionId,
      });

    } else if (action === 'sendMessage') {
      const { userMessage, sessionId } = payload;
      console.log(`[API_HANDLER_SEND] Received message for session ${sessionId}: "${userMessage.substring(0,100)}..."`);

      if (!userMessage || !sessionId) {
        console.warn("[API_HANDLER_SEND] Missing userMessage or sessionId.");
        return res.status(400).json({ error: 'Missing userMessage or sessionId.' });
      }
      if (typeof userMessage !== 'string' || userMessage.trim() === '') {
        console.warn("[API_HANDLER_SEND] User message is empty.");
        return res.status(400).json({ error: 'User message cannot be empty.' });
      }

      const session = serverSideChatSessions[sessionId];
      if (!session || !session.chatInstance) {
        console.warn(`[API_HANDLER_SEND] Chat session not found or chatInstance missing for sessionId: ${sessionId}`);
        return res.status(404).json({ error: 'Chat session not found or expired.' });
      }
      console.log(`[API_HANDLER_SEND] Session ${sessionId} found. Current history length: ${session.history.length}`);

      // 1. Generate embedding for user's message
      console.log(`[API_HANDLER_SEND] Generating embedding for user message: "${userMessage}"`);
      let queryEmbedding;
      try {
        queryEmbedding = await getEmbedding(userMessage);
      } catch (embeddingError) {
        console.error(`[API_HANDLER_SEND] Embedding generation failed for session ${sessionId}:`, embeddingError.message);
        // Respond gracefully, don't necessarily crash the whole thing
        return res.status(500).json({ error: `Could not process your query (embedding failed): ${embeddingError.message}` });
      }
      console.log(`[API_HANDLER_SEND] Embedding generated for session ${sessionId}.`);

      // 2. Query Supabase for relevant products and articles
      let contextSnippets = "";
      const MAX_CONTEXT_ITEMS = 3; 
      let products = [], articles = [];

      if (queryEmbedding) {
        console.log(`[API_HANDLER_SEND] Querying Supabase for matches for session ${sessionId}...`);
        try {
          console.log(`[API_HANDLER_SEND] Attempting to call Supabase RPC: match_products with match_threshold: 0.75, match_count: ${MAX_CONTEXT_ITEMS}`);
          const { data: matchedProducts, error: productError } = await supabase.rpc('match_products', {
            query_embedding: queryEmbedding,
            match_threshold: 0.75,
            match_count: MAX_CONTEXT_ITEMS
          });
          if (productError) {
            console.error(`[API_HANDLER_SEND] Supabase match_products RPC error for session ${sessionId}:`, productError.message, productError.details);
            throw productError; // Let the main catch block handle this
          }
          products = matchedProducts || [];
          console.log(`[API_HANDLER_SEND] Supabase match_products result for session ${sessionId}: Found ${products.length} products.`);
        } catch (e) {
          console.error(`[API_HANDLER_SEND] Exception during Supabase product match RPC for session ${sessionId}:`, e.message, e.stack);
          // Don't stop; try to get articles
        }

        try {
          console.log(`[API_HANDLER_SEND] Attempting to call Supabase RPC: match_articles with match_threshold: 0.75, match_count: ${MAX_CONTEXT_ITEMS}`);
          const { data: matchedArticles, error: articleError } = await supabase.rpc('match_articles', {
            query_embedding: queryEmbedding,
            match_threshold: 0.75,
            match_count: MAX_CONTEXT_ITEMS
          });
          if (articleError) {
            console.error(`[API_HANDLER_SEND] Supabase match_articles RPC error for session ${sessionId}:`, articleError.message, articleError.details);
            throw articleError; // Let the main catch block handle this
          }
          articles = matchedArticles || [];
          console.log(`[API_HANDLER_SEND] Supabase match_articles result for session ${sessionId}: Found ${articles.length} articles.`);
        } catch (e) {
          console.error(`[API_HANDLER_SEND] Exception during Supabase article match RPC for session ${sessionId}:`, e.message, e.stack);
          // Continue
        }
        
        let dynamicContext = "Relevant context from the store:\n";
        if (products.length > 0) {
            dynamicContext += "Products:\n";
            products.forEach(p => {
                dynamicContext += `- Title: ${p.title || 'N/A'}, Category: ${p.product_type || 'N/A'}, Description: ${p.short_description || 'N/A'}, Handle: ${p.handle || 'N/A'}\n`;
            });
        }
        if (articles.length > 0) {
            dynamicContext += "Articles:\n";
            articles.forEach(a => {
                dynamicContext += `- Title: ${a.title || 'N/A'}, Excerpt: ${a.excerpt || 'N/A'}, Handle: ${a.handle || 'N/A'}\n`;
            });
        }
        if (products.length === 0 && articles.length === 0) {
            dynamicContext += "No specific products or articles found matching your query in the database.\n";
        }
        contextSnippets = dynamicContext;
        console.log(`[API_HANDLER_SEND] Generated contextSnippets for session ${sessionId} (first 200 chars): "${contextSnippets.substring(0,200)}..."`);
      } else {
        contextSnippets = "Could not process query for semantic search (embedding failed).\n";
        console.warn(`[API_HANDLER_SEND] Embedding was null/empty for session ${sessionId}. Context will be minimal.`);
      }
      
      // Prepare content for Gemini, including history and new context
      const currentHistory = session.history;
      // The user's actual query is now part of the history.
      // The contextSnippets should be presented clearly to the model.
      // We'll inject the context as a new user part before the actual user message that Gemini needs to respond to.
      // This makes the context part of the immediate turn.
      const contentsForGemini = [
        ...currentHistory,
        { 
          role: "user", 
          parts: [
            { text: `CONTEXT FOR YOUR RESPONSE:\n${contextSnippets}\n\nUSER QUERY:\n${userMessage}` }
            // Note: Some models prefer context and query separate. This combines them in one user turn.
            // Alternative: {role: "system", parts: [{text: contextSnippets}]}, {role: "user", parts: [{text: userMessage}]}
            // But system role is not officially part of sendMessage's `contents` structure.
            // The official way for multi-turn history with parts for Gemini API Chat is just alternating user/model roles.
          ] 
        }
      ];
      console.log(`[API_HANDLER_SEND] Preparing to send message to Gemini for session ${sessionId}. History length: ${currentHistory.length}, Total parts for Gemini: ${contentsForGemini.length}`);
      console.log(`[API_HANDLER_SEND] Last part of contentsForGemini (user message with context) for session ${sessionId}: "${JSON.stringify(contentsForGemini[contentsForGemini.length-1]).substring(0,300)}..."`);

      const geminiResponse = await session.chatInstance.sendMessage({
          contents: contentsForGemini // Send the augmented history
      });
      const aiResponseText = geminiResponse.text;
      console.log(`[API_HANDLER_SEND] Gemini response received for session ${sessionId}: "${aiResponseText.substring(0,100)}..."`);
      
      // Update our explicit history
      session.history.push({ role: "user", parts: [{ text: userMessage }] }); // Log the clean user message
      session.history.push({ role: "model", parts: [{ text: aiResponseText }] });
      console.log(`[API_HANDLER_SEND] History updated for session ${sessionId}. New length: ${session.history.length}`);

      // Trim history if it gets too long
      const MAX_HISTORY_TURNS = 10; // Each turn is a user + model message
      if (session.history.length > MAX_HISTORY_TURNS * 2) {
          session.history = session.history.slice(-MAX_HISTORY_TURNS * 2);
          console.log(`[API_HANDLER_SEND] History trimmed for session ${sessionId}. New length: ${session.history.length}`);
      }

      // Log this interaction
      await logChatInteraction(sessionId, userMessage, contextSnippets, aiResponseText);
      
      return res.status(200).json({ text: aiResponseText });

    } else if (action === 'endSession') {
      const { sessionId } = payload;
      console.log(`[API_HANDLER_END] Attempting to end session: ${sessionId}`);
      if (sessionId && serverSideChatSessions[sessionId]) {
        delete serverSideChatSessions[sessionId];
        console.log(`[API_HANDLER_END] Chat session_v2 ended and removed: ${sessionId}`);
        return res.status(200).json({ message: 'Session ended.' });
      }
      console.warn(`[API_HANDLER_END] Session not found or already ended: ${sessionId}`);
      return res.status(404).json({ message: 'Session not found or already ended.'});

    } else {
      console.warn(`[API_HANDLER] Invalid action specified: ${action}`);
      return res.status(400).json({ error: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error(`[API_HANDLER] Error in /api/chat (action: ${action || 'unknown'}):`, error.message, error.stack);
    // Determine a user-friendly error message
    let clientErrorMessage = 'An error occurred while processing your request with the AI service. Please check server logs for details.';
    if (error.message) {
        if (error.message.includes('SAFETY')) {
            clientErrorMessage = "The AI could not provide a response due to safety guidelines. Please try rephrasing your request.";
        } else if (error.message.toLowerCase().includes('api key not valid') || error.message.toLowerCase().includes('permission denied')) {
            clientErrorMessage = "There's an issue with the AI service configuration or authentication on the server.";
        } else if (error.message.startsWith("Failed to generate embedding")) {
            clientErrorMessage = "Could not process your query due to an issue with understanding the input. Please try rephrasing.";
        } else if (error.message.includes("Supabase") || error.message.includes("RPC")) {
            clientErrorMessage = "There was an issue accessing store data. Please try again later.";
        }
    }
    return res.status(500).json({ error: clientErrorMessage });
  }
}
