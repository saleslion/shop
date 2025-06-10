import { GoogleGenAI } from '@google/genai';

// This will be set in Vercel Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17'; // Or from another env var

// In-memory store for chat sessions. For production, consider a more persistent store.
let serverSideChatSessions = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Ensure API key is available
  if (!GEMINI_API_KEY) {
    console.error("CRITICAL_ERROR: GEMINI_API_KEY is not set in the serverless function environment.");
    return res.status(500).json({ error: 'AI service configuration error on server. API key missing.' });
  }

  // Initialize AI SDK here, now that we know the API key should be present.
  // If GEMINI_API_KEY was indeed missing, the check above would have caught it.
  let ai;
  try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  } catch (sdkError) {
    console.error("CRITICAL_ERROR: Failed to initialize GoogleGenAI SDK. Likely an issue with the API Key format or SDK itself even if key is present.", sdkError);
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

      const categoryNames = (storeContext.categories || []).map(c => `${c.name} (${c.productCount} products)`).join(', ') || 'various items';
      const articleInfos = (storeContext.articles || []).map(a => `- "${a.title}" (Handle: ${a.handle}, Tags: ${(a.tags || []).join(', ') || 'N/A'})`).join('\n') || 'a selection of blog posts';
      const productInfos = (storeContext.products || []).map(p => `- "${p.title}" (Handle: ${p.handle}, Category: ${p.product_type}, Tags: ${(p.tags || []).join(', ') || 'N/A'})`).join('\n') || 'a range of products';
      const currentStoreDomainForLinks = storeDomain.includes('.') ? storeDomain : `${storeDomain}.myshopify.com`;

      const systemInstruction = `You are a friendly, expert AI shopping assistant for "Hifisti".
Context:
1. Categories: ${categoryNames}.
2. Products (Handles for links):
${productInfos}
3. Articles (Handles for links):
${articleInfos}
4. Store domain for links: ${currentStoreDomainForLinks}

Task:
- Be concise (2-3 sentences usually).
- If unsure, ask clarifying questions.
- For products/articles, give name and full URL: https://${currentStoreDomainForLinks}/products/[handle] or /articles/[handle].
- Match product_type strictly to user's request (e.g., 'headphones' for headphones).
- Proactively suggest relevant articles.
- Do not invent products/articles not in context.`;

      const chat = ai.chats.create({
        model: GEMINI_MODEL_NAME,
        config: { systemInstruction, temperature: 0.7, topP: 0.9 },
        history: []
      });
      serverSideChatSessions[newSessionId] = { chat, storeDomain: currentStoreDomainForLinks };

      const welcomePrompt = "Provide a concise (1-2 sentences) welcome for Hifisti's AI assistant.";
      const result = await chat.sendMessage({ message: welcomePrompt });
      return res.status(200).json({ text: result.text, sessionId: newSessionId });

    } else if (action === 'sendMessage') {
      const { userMessage, sessionId } = payload;
      if (!sessionId || !serverSideChatSessions[sessionId]) {
        console.warn(`Invalid or expired chat session ID received: ${sessionId}`);
        return res.status(400).json({ error: 'Invalid or expired chat session. Please refresh.' });
      }
      if (!userMessage) {
        return res.status(400).json({ error: 'User message is missing.' });
      }

      const { chat } = serverSideChatSessions[sessionId];
      const result = await chat.sendMessage({ message: userMessage });
      return res.status(200).json({ text: result.text });

    } else if (action === 'endSession') {
      const { sessionId } = payload;
      if (sessionId && serverSideChatSessions[sessionId]) {
        delete serverSideChatSessions[sessionId];
      }
      return res.status(200).json({ message: 'Session ended' });

    } else {
      return res.status(400).json({ error: 'Invalid action specified.' });
    }
  } catch (error) {
    console.error('Error in AI chat handler (action: ' + action + '):', error);
    let errorMessage = 'Failed to process AI chat request.';
    // Check for specific error messages that might originate from Google's API
    if (error.message) {
        if (error.message.includes("API Key") || error.message.includes("permission") || error.message.includes("billing")) {
            errorMessage = "AI service authentication or billing issue on server. Please contact support.";
        } else if (error.message.includes("quota")) {
            errorMessage = "AI service quota exceeded on server. Please try again later.";
        } else {
            // Avoid leaking too much internal detail, but retain some info
            errorMessage = `An unexpected AI processing error occurred: ${error.name || 'Error'}`;
        }
    }
    return res.status(500).json({ error: errorMessage });
  }
}