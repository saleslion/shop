import { GoogleGenAI } from '@google/genai';

// This will be set in Vercel Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17'; // Or from env var

if (!GEMINI_API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not set in serverless function environment.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
let serverSideChatSessions = {}; // Simple in-memory session store for demo

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, payload, sessionId } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI service is not configured correctly.' });
    }

    try {
      if (action === 'initialize') {
        const { storeContext, storeDomain } = payload;
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const categoryNames = storeContext.categories.map(c => `${c.name} (${c.productCount} products)`).join(', ') || 'various items';
        const articleInfos = storeContext.articles.map(a => `- "${a.title}" (Handle: ${a.handle}, Tags: ${a.tags.join(', ') || 'N/A'})`).join('\n') || 'a selection of blog posts';
        const productInfos = storeContext.products.map(p => `- "${p.title}" (Handle: ${p.handle}, Category: ${p.product_type}, Tags: ${p.tags.join(', ') || 'N/A'})`).join('\n') || 'a range of products';
        const currentStoreDomainForLinks = storeDomain.includes('.') ? storeDomain : `${storeDomain}.myshopify.com`;


        const systemInstruction = `You are a friendly, expert AI shopping assistant specifically for the Shopify store: "Hifisti".