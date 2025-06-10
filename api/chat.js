// File: api/chat.js
// (This file should be in the 'api' folder at the root of your Vite project)
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

let serverSideChatSessions = {}; // Simple in-memory session store

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!GEMINI_API_KEY) {
    console.error("CRITICAL_SERVER_ERROR: GEMINI_API_KEY is not set in Vercel environment.");
    return res.status(500).json({ error: 'AI service configuration error (API key missing on server).' });
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
      const categoryNames = (storeContext.categories || []).map(c => `${c.name} (${c.productCount} products)`).join(', ') || 'various items';
      const articleInfos = (storeContext.articles || []).map(a => `- "${a.title}" (Handle: ${a.handle}, Tags: ${(a.tags || []).join(', ') || 'N/A'})`).join('\n') || 'a selection of blog posts';
      const productInfos = (storeContext.products || []).map(p => `- "${p.title}" (Handle: ${p.handle}, Category: ${p.product_type}, Tags: ${(p.tags || []).join(', ') || 'N/A'})`).join('\n') || 'a range of products';
      const currentStoreDomainForLinks = storeDomain.includes('.') ? storeDomain : `${storeDomain}.myshopify.com`;

      const systemInstruction = `You are a friendly, expert AI shopping assistant for "Hifisti".`;