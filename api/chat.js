// File: api/chat.js
// (This file should be in the 'api' folder at the root of your project)
import { GoogleGenAI, Chat } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17'; // Ensure this is your desired model

// Simple in-memory store for server-side chat sessions
// For a production app, consider a more robust session store (e.g., Redis, Firestore)
// if you need sessions to persist across multiple serverless function invocations
// or scale beyond what a single instance can handle.
// However, for Vercel's typical behavior, the `Chat` object itself maintains conversation history
// for its lifetime, and this map just holds onto those `Chat` objects per sessionID.
let serverSideChatSessions = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!GEMINI_API_KEY) {
    console.error("CRITICAL_SERVER_ERROR: GEMINI_API_KEY is not set in Vercel environment.");
    // Do not expose the exact error "API key missing" to the client for security.
    return res.status(500).json({ error: 'AI service configuration error on server.' });
  }

  let ai;
  try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  } catch (sdkError) {
    console.error("CRITICAL_SERVER_ERROR: Failed to initialize GoogleGenAI SDK.", sdkError);
    return res.status(500).json({ error: 'AI service SDK initialization failed on server.' });
  }

  const { action, payload } = req.body;

  try {
    if (action === 'initialize') {
      const { storeContext, storeDomain } = payload;
      if (!storeContext || !storeDomain) {
        return res.status(400).json({ error: 'Missing storeContext or storeDomain for initialization.' });
      }

      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const storeName = storeContext.storeName || "the store";
      const categoryNames = (storeContext.categories || []).map(c => `${c.name} (${c.productCount} products)`).join(', ') || 'various items';
      const articleInfos = (storeContext.articles || []).map(a => `- "${a.title}" (ID: ${a.id}, Handle: ${a.handle}, Tags: ${(a.tags || []).join(', ') || 'N/A'}, Excerpt: ${a.excerpt})`).join('\n') || 'a selection of blog posts';
      const productInfos = (storeContext.products || []).map(p => `- "${p.title}" (ID: ${p.id}, Handle: ${p.handle}, Category: ${p.product_type}, Tags: ${(p.tags || []).join(', ') || 'N/A'}, Description: ${p.short_description})`).join('\n') || 'a range of products';
      const currentStoreDomainForLinks = storeDomain.includes('.') ? storeDomain : `${storeDomain}.myshopify.com`;

      // Construct a comprehensive system instruction
      const systemInstruction = `You are a friendly, expert AI shopping assistant for "${storeName}".
Your goal is to guide users to relevant products and articles based on their queries and the provided store context.
You must adhere to the following instructions:
1.  **Primary Goal**: Help users find products or information within ${storeName}.
2.  **Context Awareness**: You have been provided with the following context about the store:
    *   Store Name: ${storeName}
    *   Store Domain for constructing links: ${currentStoreDomainForLinks}
    *   Available Product Categories: ${categoryNames}.
    *   Available Products (Title, ID, Handle, Category, Tags, Short Description):
        ${productInfos}
    *   Available Articles/Blog Posts (Title, ID, Handle, Tags, Excerpt):
        ${articleInfos}
3.  **Responding to Queries**:
    *   When a user asks about products or categories, use the product information above.
    *   When a user asks for advice or information that might be in a blog post, use the article information.
    *   If a user's query is ambiguous, ask clarifying questions.
4.  **Referring to Products/Articles**:
    *   When suggesting a product, mention its full title. If relevant, also mention its category.
    *   When suggesting an article, mention its full title.
5.  **Providing Links**:
    *   If you identify a specific product the user might be interested in, you can provide a link. Product links should be in the format: https://${currentStoreDomainForLinks}/products/{product_handle}
    *   If you identify a specific article, you can provide a link. Article links are typically: https://${currentStoreDomainForLinks}/blogs/{blog_handle}/{article_handle}. Assume a common blog handle like 'news' or 'blog' if not specified. For example: https://${currentStoreDomainForLinks}/blogs/news/{article_handle}.
    *   **Only provide links if you are confident about the handle and the item exists in the provided context.**
6.  **Tone**: Be helpful, polite, and conversational.
7.  **Limitations**:
    *   Stick to the information provided in the context. Do not invent products, articles, or information not present.
    *   If you cannot answer a question based on the context, politely say so (e.g., "I don't have information about that specific topic based on the current store data.").
    *   Do not process orders, check inventory levels, or perform actions outside of providing information and advice based on the store catalog and articles.
    *   Do not ask for personal information.
8.  **Conversation Flow**: Start the conversation with a friendly welcome message and ask how you can help the user today with their ${storeName} shopping needs.

Begin the first message by welcoming the user to the ${storeName} AI Advisor and asking how you can assist them.
`;

      const chat = ai.chats.create({
        model: GEMINI_MODEL_NAME,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      serverSideChatSessions[newSessionId] = chat;

      // Send an initial message from the AI based on the system instruction context
      // For example, "Hello! I'm the AI assistant for {storeName}. How can I help you explore our products or articles today?"
      // The system instruction already guides the AI to start the conversation.
      // We can send an empty first message from user side to trigger AI's first response,
      // or let the AI generate its first message based on system instruction directly if supported.
      // For explicit first message:
      const initialAiResponse = await chat.sendMessage({ message: "Hello" }); // User says "Hello" implicitly to start

      return res.status(200).json({
        text: initialAiResponse.text,
        sessionId: newSessionId,
      });

    } else if (action === 'sendMessage') {
      const { userMessage, sessionId } = payload;
      if (!userMessage || !sessionId) {
        return res.status(400).json({ error: 'Missing userMessage or sessionId.' });
      }

      const chatSession = serverSideChatSessions[sessionId];
      if (!chatSession) {
        return res.status(404).json({ error: 'Chat session not found or expired.' });
      }

      const response = await chatSession.sendMessage({ message: userMessage });
      return res.status(200).json({ text: response.text });

    } else if (action === 'endSession') {
      const { sessionId } = payload;
      if (sessionId && serverSideChatSessions[sessionId]) {
        delete serverSideChatSessions[sessionId];
        console.log(`Chat session ended and removed: ${sessionId}`);
        return res.status(200).json({ message: 'Session ended.' });
      }
      return res.status(404).json({ message: 'Session not found or already ended.'});

    } else {
      return res.status(400).json({ error: 'Invalid action specified.' });
    }

  } catch (error) {
    console.error(`Error in /api/chat (action: ${action}):`, error);
    // Avoid sending detailed error messages to the client in production
    let clientErrorMessage = 'An error occurred while processing your request with the AI service.';
    if (error.message && error.message.includes('SAFETY')) {
        clientErrorMessage = "The AI could not provide a response due to safety guidelines. Please try rephrasing your request."
    } else if (error.message && error.message.toLowerCase().includes('api key not valid')) {
        clientErrorMessage = "There's an issue with the AI service configuration on the server."
    }
    // Additional error handling for specific Gemini errors can be added here
    return res.status(500).json({ error: clientErrorMessage });
  }
}