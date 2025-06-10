
// File: api/chat.js
// This file should be in the 'api' folder at the root of your Vercel project.

import { GoogleGenAI, Chat } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Environment Variables (set these in Vercel)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17'; // Ensure this matches your constants

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service_role for backend operations

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL_SERVER_ERROR: Missing GEMINI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    // Required for service_role key. See https://supabase.com/docs/guides/auth/server-side/creating-a-client#use-service-role-key
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});


// Simple in-memory store for server-side chat sessions (Gemini Chat objects)
let serverSideChatSessions = {}; // sessionId -> Chat object

const EMBEDDING_MODEL_NAME = 'text-embedding-004'; // Google's embedding model

async function getEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.warn("getEmbedding called with invalid text:", text);
    // Optionally throw an error or return null, depending on how you want to handle this.
    // For now, let's allow it to proceed and potentially fail at the API level if that's preferred,
    // or handle it more gracefully by returning null/empty array.
    // Given the API error, it's better to ensure valid input or throw.
    throw new Error("Cannot generate embedding for empty or invalid text.");
  }
  try {
    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL_NAME,
        content: { parts: [{ text: text }] }, // Corrected content structure
    });
    return response.embedding.values;
  } catch (e) {
    console.error("Error generating embedding:", e);
    // Potentially throw or return null to handle upstream
    // For now, let's rethrow to make it visible
    throw new Error(`Failed to generate embedding: ${e.message}`);
  }
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // This check is good, but the variables might be undefined earlier if not set, leading to client init errors
    // For now, this server-side check is fine.
    console.error("CRITICAL_SERVER_ERROR: One or more environment variables (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not set.");
    return res.status(500).json({ error: 'AI service or Database configuration error on server.' });
  }

  const { action, payload } = req.body;

  try {
    if (action === 'initialize') {
      const { storeName, storeDomain } = payload; // Simplified payload
      if (!storeName || !storeDomain) {
        return res.status(400).json({ error: 'Missing storeName or storeDomain for initialization.' });
      }

      const newSessionId = `session_v2_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const systemInstruction = `You are a friendly, expert AI shopping assistant for "${storeName}".
Your goal is to guide users to relevant products and articles based on their queries.
You will be provided with relevant product and article snippets based on the user's query from a database.
Base your answers primarily on the provided snippets.
If the provided snippets are not relevant or insufficient, you can say that you couldn't find specific information in the current context.
When suggesting products or articles from the snippets, mention their titles.
Product links use the format: https://${storeDomain}/products/{product_handle}
Article links use the format: https://${storeDomain}/blogs/{blog_handle}/{article_handle} (assume blog_handle is 'news' if not specified).
Be helpful, polite, and stick to the information provided. Do not invent products or information.
Start the conversation with a friendly welcome message and ask how you can help.`;

      const chat = ai.chats.create({
        model: GEMINI_MODEL_NAME,
        config: { systemInstruction: systemInstruction },
        // History will be managed explicitly
      });
      serverSideChatSessions[newSessionId] = { chatInstance: chat, history: [] };

      // Let AI generate its first message based on system instruction
      // Send an empty first message from user side to trigger AI's first response,
      // or let the AI generate its first message based on system instruction directly if supported.
      const initialAiResponse = await chat.sendMessage({ message: "Hello" }); // User implicitly says "Hello"

      serverSideChatSessions[newSessionId].history.push({ role: "user", parts: [{ text: "Hello" }] });
      serverSideChatSessions[newSessionId].history.push({ role: "model", parts: [{ text: initialAiResponse.text }] });
      
      return res.status(200).json({
        text: initialAiResponse.text,
        sessionId: newSessionId,
      });

    } else if (action === 'sendMessage') {
      const { userMessage, sessionId } = payload;
      if (!userMessage || !sessionId) {
        return res.status(400).json({ error: 'Missing userMessage or sessionId.' });
      }
      if (typeof userMessage !== 'string' || userMessage.trim() === '') {
        return res.status(400).json({ error: 'User message cannot be empty.' });
      }

      const session = serverSideChatSessions[sessionId];
      if (!session || !session.chatInstance) {
        return res.status(404).json({ error: 'Chat session not found or expired.' });
      }

      // 1. Generate embedding for user's message
      const queryEmbedding = await getEmbedding(userMessage);

      // 2. Query Supabase for relevant products and articles
      let contextSnippets = "";
      const MAX_CONTEXT_ITEMS = 3; // Max N products and N articles

      if (queryEmbedding) {
        // Ensure RPC calls are awaited and errors are handled
        let products = [], articles = [];
        try {
          const { data: matchedProducts, error: productError } = await supabase.rpc('match_products', {
            query_embedding: queryEmbedding,
            match_threshold: 0.75, // Adjust this threshold
            match_count: MAX_CONTEXT_ITEMS
          });
          if (productError) throw productError;
          products = matchedProducts;
        } catch (e) {
          console.error("Supabase product match RPC error:", e.message);
        }

        try {
          const { data: matchedArticles, error: articleError } = await supabase.rpc('match_articles', {
            query_embedding: queryEmbedding,
            match_threshold: 0.75, // Adjust this threshold
            match_count: MAX_CONTEXT_ITEMS
          });
          if (articleError) throw articleError;
          articles = matchedArticles;
        } catch (e) {
          console.error("Supabase article match RPC error:", e.message);
        }
        
        let dynamicContext = "Relevant context from the store:\n";
        if (products && products.length > 0) {
            dynamicContext += "Products:\n";
            products.forEach(p => { // Ensure p is not null/undefined
                dynamicContext += `- Title: ${p.title || 'N/A'}, Category: ${p.product_type || 'N/A'}, Description: ${p.short_description || 'N/A'}, Handle: ${p.handle || 'N/A'}\n`;
            });
        }
        if (articles && articles.length > 0) {
            dynamicContext += "Articles:\n";
            articles.forEach(a => { // Ensure a is not null/undefined
                dynamicContext += `- Title: ${a.title || 'N/A'}, Excerpt: ${a.excerpt || 'N/A'}, Handle: ${a.handle || 'N/A'}\n`;
            });
        }
        if ((!products || products.length === 0) && (!articles || articles.length === 0)) {
            dynamicContext += "No specific products or articles found matching your query in the database.\n";
        }
        contextSnippets = dynamicContext;
      } else {
        contextSnippets = "Could not process query for semantic search (embedding failed).\n";
      }
      
      const currentHistory = session.history;
      
      const contentsForGemini = [
        ...currentHistory,
        // The user's actual query is now part of the history.
        // The contextSnippets should be presented clearly to the model.
        // Option 1: Append context to the last user message (careful with token limits)
        // Option 2: Insert a system-like message with context (might be cleaner)
        // Let's try appending to user message as it's common for RAG context injection.
        { role: "user", parts: [{ text: `User query: "${userMessage}"\n\nBased on the following information from the store, please answer the query:\n${contextSnippets}` }] }
      ];

      const response = await session.chatInstance.sendMessage({
          contents: contentsForGemini
      });
      
      // Update history: Store the original user message and the AI's response
      session.history.push({ role: "user", parts: [{ text: userMessage }] }); 
      session.history.push({ role: "model", parts: [{ text: response.text }] });

      const MAX_HISTORY_TURNS = 10; 
      if (session.history.length > MAX_HISTORY_TURNS * 2) {
          session.history = session.history.slice(-MAX_HISTORY_TURNS * 2);
      }

      return res.status(200).json({ text: response.text });

    } else if (action === 'endSession') {
      const { sessionId } = payload;
      if (sessionId && serverSideChatSessions[sessionId]) {
        delete serverSideChatSessions[sessionId];
        console.log(`Chat session_v2 ended and removed: ${sessionId}`);
        return res.status(200).json({ message: 'Session ended.' });
      }
      return res.status(404).json({ message: 'Session not found or already ended.'});

    } else {
      return res.status(400).json({ error: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error(`Error in /api/chat (action: ${action || 'unknown'}):`, error.message, error.stack);
    let clientErrorMessage = 'An error occurred while processing your request with the AI service.';
    if (error.message && error.message.includes('SAFETY')) {
        clientErrorMessage = "The AI could not provide a response due to safety guidelines. Please try rephrasing your request."
    } else if (error.message && error.message.toLowerCase().includes('api key not valid')) {
        clientErrorMessage = "There's an issue with the AI service configuration on the server."
    } // Add more specific error checks if needed
    return res.status(500).json({ error: clientErrorMessage });
  }
}
