
// Represents a simplified Shopify Product
export interface ShopifyProduct {
  id: string; // e.g., "gid://shopify/Product/1234567890"
  handle: string; // URL-friendly product identifier
  title: string;
  body_html: string; // Product description, can contain HTML
  vendor: string;
  product_type: string; // Product category
  tags: string[];
  images: Array<{ // Shopify returns an array of images
    src: string;
    altText?: string | null;
  }>;
}

// Represents a simplified Shopify Article (Blog Post)
export interface ShopifyArticle {
  id:string; // e.g., "gid://shopify/Article/1234567890"
  handle: string; // URL-friendly article identifier
  title: string;
  body_html: string; // Article content, can contain HTML
  excerpt_html?: string | null; // A short summary, can contain HTML
  blog_title: string;
  author_name: string;
  tags: string[];
  image?: { // Shopify article image
    src: string;
    altText?: string | null;
  } | null;
}

// Represents a derived Shopify Category (Product Type)
export interface ShopifyCategory {
  name: string; // The product_type value
  productCount: number; // Number of products in this category
}

// Simplified article information passed to the AI prompt for context (PRE-RAG, less used now)
// For RAG, the backend will format snippets from Supabase.
export interface ShopifyArticleContextInfo {
  id: string;
  handle: string;
  title: string;
  excerpt: string; // Plain text excerpt
  tags: string[];
}

// Simplified product information passed to the AI prompt for context (PRE-RAG, less used now)
// For RAG, the backend will format snippets from Supabase.
export interface ShopifyProductContextInfo {
  id: string;
  handle: string; 
  title: string;
  product_type: string; // Category
  tags: string[];
  short_description: string; 
}

// This might still be useful for direct Shopify calls, e.g. for UI display.
export interface StorefrontApiCredentials {
  storeDomain: string; 
  storefrontAccessToken: string;
}

// Represents a message in the chat interface
export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
  // Potential future extension for RAG:
  // retrieved_context?: Array<{type: 'product' | 'article', title: string, id: string, similarity?: number}>;
}

// Represents the structure for logging chat interactions to Supabase
export interface ChatInteractionLog {
  id?: string; // Optional: Supabase will generate UUID
  session_id: string;
  user_query: string;
  retrieved_context_summary: string | null; // Can be a JSON string of context items or a textual summary
  ai_response: string;
  timestamp?: Date; // Optional: Supabase will generate timestamp
}
