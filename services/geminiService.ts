
import { GoogleGenAI, Chat, GenerateContentResponse, Content } from "@google/genai";
import { ShopifyArticle, ShopifyCategory, ShopifyArticleContextInfo, ShopifyProductContextInfo } from '../types';
import { GEMINI_MODEL_NAME } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY_PLACEHOLDER" });
let chat: Chat | null = null;
let currentStoreDomainForLinks: string = "your-store.myshopify.com"; // Fallback

// Helper to extract plain text from HTML (very basic)
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

interface ShopifyStoreContext {
  storeName: string | null; // Will be "Hifisti"
  categories: ShopifyCategory[];
  articles: ShopifyArticleContextInfo[];
  products: ShopifyProductContextInfo[]; 
}

export const initializeChatSession = async (storeContext: ShopifyStoreContext, storeDomain: string): Promise<string> => {
  if (!API_KEY || API_KEY === "MISSING_API_KEY_PLACEHOLDER") {
    throw new Error("Gemini API Key is not configured. Please set the API_KEY environment variable.");
  }

  currentStoreDomainForLinks = storeDomain.includes('.') ? storeDomain : `${storeDomain}.myshopify.com`;
  const { storeName, categories, articles, products } = storeContext; // storeName will be "Hifisti"

  const categoryNames = categories.map(c => `${c.name} (${c.productCount} products)`).join(', ') || 'various items';
  const articleInfos = articles.map(a => `- "${a.title}" (Handle: ${a.handle}, Tags: ${a.tags.join(', ') || 'N/A'}, Excerpt: ${a.excerpt.substring(0,100)}...)`).join('\n') || 'a selection of blog posts';
  const productInfos = products.map(p => `- "${p.title}" (Handle: ${p.handle}, Category: ${p.product_type}, Tags: ${p.tags.join(', ') || 'N/A'}, Desc: ${p.short_description.substring(0,100)}...)`).join('\n') || 'a range of products';

  const systemInstruction = `You are a friendly, expert AI shopping assistant specifically for the Shopify store: "Hifisti".
Your primary goal is to help users discover Hifisti's products and make informed decisions by leveraging your knowledge of Hifisti's product categories, specific products (including their handles for linking), and related articles (including their handles for linking).

You have access to the following information about Hifisti:
1. Product Categories: ${categoryNames}.
2. Specific Products (with handles):
${productInfos}
3. Articles/Blog Posts (with handles):
${articleInfos}
4. The store domain for constructing links is: ${currentStoreDomainForLinks} (this is hifisti.myshopify.com)

Your Task:
- Engage users in a natural, conversational manner. Keep your responses **informative but concise**. Aim for 2-3 sentences for most answers unless more detail is specifically requested or necessary.
- When a user expresses a general need for a specific type of product (e.g., "I need headphones"), **you MUST ask clarifying questions** to understand their specific requirements before making recommendations.
- Once you have a better understanding, you can:
  - Recommend **specific products** from Hifisti that match their needs. 
  - **When recommending a product, state its name and provide a direct, full URL to it using the format: https://${currentStoreDomainForLinks}/products/[product_handle]**. Replace [product_handle] with the actual handle from your product context.
  - Briefly explain why the product is a good fit.
  - **Crucially, ensure the product's category (product_type) directly aligns with the user's stated product type request.**
  - **Proactively suggest relevant articles** from your context if they provide useful information for the user's decision-making process (e.g., buying guides, comparisons, feature explanations). 
  - **When recommending an article, state its title and provide a direct, full URL to it using the format: https://${currentStoreDomainForLinks}/articles/[article_handle]**. Replace [article_handle] with the actual handle from your article context.
- If a user asks about a specific Hifisti product you know, provide information based on its details and include a link to it.
- **Do not make up products, articles, handles, or URLs not supported by your provided context for Hifisti.**
- If you don't have enough information to make a specific recommendation, explain what additional details you need from the user.`;


  chat = ai.chats.create({
    model: GEMINI_MODEL_NAME,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7, 
      topP: 0.9,
    },
    history: [] 
  });

  try {
    const welcomePrompt = "Please provide a friendly, CONCISE welcome message for the user (1-2 sentences), acknowledging you are an AI assistant for Hifisti and are ready to help them find audio equipment. Do not list all your capabilities, just a simple welcome.";
    const result: GenerateContentResponse = await chat.sendMessage({message: welcomePrompt});
    return result.text;
  } catch (error) {
    console.error("Error sending initial welcome message:", error);
    return `Hello! I'm the AI assistant for Hifisti. How can I assist you with your audio needs today?`; // Fallback welcome
  }
};

export const sendChatMessage = async (userMessage: string): Promise<string> => {
  if (!chat) {
    throw new Error("Chat session not initialized. Please call initializeChatSession first.");
  }
  if (!API_KEY || API_KEY === "MISSING_API_KEY_PLACEHOLDER") {
    throw new Error("Gemini API Key is not configured.");
  }

  try {
    const result: GenerateContentResponse = await chat.sendMessage({message: userMessage});
    return result.text;
  } catch (error) {
    console.error("Error sending chat message to Gemini:", error);
    if (error instanceof Error) {
      if (error.message.includes("API Key not valid")) {
           throw new Error("Invalid Gemini API Key. Please check your configuration.");
      }
      throw new Error(`Failed to get chat response from AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred while sending chat message.");
  }
};

export const endChatSession = () => {
  chat = null;
  currentStoreDomainForLinks = "your-store.myshopify.com"; // Reset
  console.log("Chat session ended.");
};
    