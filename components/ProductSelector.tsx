import React from 'react';
import { ShopifyCategory } from '../types'; // Assuming types.ts is in ../src/ or adjust path

interface ProductSelectorProps {
  categories: ShopifyCategory[];
  onSelectCategory?: (categoryName: string) => void;
  // storeDomain: string; // Needed if constructing links here
}

const ProductSelector: React.FC<ProductSelectorProps> = ({ categories, onSelectCategory }) => {
  if (!categories || categories.length === 0) {
    return <p className="text-slate-400 text-sm p-4">No product categories available.</p>;
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-sky-400 mb-3">Product Categories</h3>
      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category.name}>
            <button
              onClick={() => onSelectCategory && onSelectCategory(category.name)}
              className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label={`Select category: ${category.name}`}
            >
              {category.name} ({category.productCount} products)
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductSelector;