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

// Simplified article information passed to the AI prompt for context
export interface ShopifyArticleContextInfo {
  id: string;
  handle: string;
  title: string;
  excerpt: string; // Plain text excerpt
  tags: string[];
}

// Simplified product information passed to the AI prompt for context
export interface ShopifyProductContextInfo {
  id: string;
  handle: string; // Added handle for constructing URLs
  title: string;
  product_type: string; // Category
  tags: string[];
  // A very short summary of key features, derived from body_html or tags
  short_description: string; 
}


export interface StorefrontApiCredentials {
  storeDomain: string; // e.g., "your-store.myshopify.com" or just "your-store"
  storefrontAccessToken: string;
}

// Represents a message in the chat interface
export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system'; // 'system' for initial instructions or silent context
  text: string;
  timestamp: Date;
  // We could add more fields like 'recommendedArticleIds' if AI gives structured data
}