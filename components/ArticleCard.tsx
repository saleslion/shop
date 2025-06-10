import React from 'react';
import { ShopifyArticleContextInfo } from '../types'; // Assuming types.ts is in ../src/ or adjust path

interface ArticleCardProps {
  article: ShopifyArticleContextInfo;
  storeDomain: string; // e.g., "hifisti.myshopify.com" - needed for constructing full URLs
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, storeDomain }) => {
  // Basic placeholder for blog handle - this might need more robust logic or data
  // Common blog handles are 'news', 'blog'. This is a guess.
  const defaultBlogHandle = 'news'; 
  
  // Construct a plausible URL. Shopify article URLs are typically /blogs/{blog_handle}/{article_handle}
  // The article.id might also contain blog handle information or might be needed for different URL structures.
  // For now, we use a common pattern.
  const articleUrl = `https://${storeDomain}/blogs/${defaultBlogHandle}/${article.handle}`;

  return (
    <div className="card p-4 my-2"> {/* Use global .card style or Tailwind classes */}
      <h3 className="text-lg font-semibold text-sky-400 mb-2">{article.title}</h3>
      {article.excerpt && (
        <p className="text-slate-300 text-sm mb-3 whitespace-pre-line">
          {article.excerpt}
        </p>
      )}
      {article.tags && article.tags.length > 0 && (
        <div className="mb-3">
          {article.tags.slice(0, 3).map(tag => (
            <span key={tag} className="inline-block bg-slate-700 text-slate-200 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      <a
        href={articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-500 hover:text-sky-400 hover:underline font-medium text-sm transition-colors"
      >
        Read More &rarr;
      </a>
    </div>
  );
};

export default ArticleCard;