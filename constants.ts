import { ShopifyProduct, ShopifyArticle } from './types';

export const MOCK_SHOPIFY_PRODUCTS: ShopifyProduct[] = [
  {
    id: 'gid://shopify/Product/7890123456',
    handle: 'eco-friendly-yoga-mat',
    title: 'ZenFlow Eco Yoga Mat Deluxe',
    body_html: '<p>Experience unparalleled comfort and grip with our <strong>ZenFlow Eco Yoga Mat Deluxe</strong>. Made from sustainable materials, it\'s perfect for all yoga styles, pilates, and general fitness. Non-slip surface ensures stability during complex poses.</p><ul><li>Eco-friendly TPE material</li><li>Superior grip and cushioning</li><li>Lightweight and durable</li></ul>',
    vendor: 'Zen Wellness Co.',
    product_type: 'Yoga Gear',
    tags: ['yoga', 'fitness', 'eco-friendly', 'mat'],
    images: [{ src: 'https://picsum.photos/seed/yogamat_shopify/600/600', altText: 'Eco-friendly yoga mat' }],
  },
  {
    id: 'gid://shopify/Product/1234567890',
    handle: 'smart-thermostat-x1000',
    title: 'SmartHome+ Thermostat X1000',
    body_html: '<p>Upgrade your home with the <strong>SmartHome+ Thermostat X1000</strong>. Save energy, control your climate remotely, and enjoy intelligent scheduling. Integrates seamlessly with your smart home ecosystem.</p><p>Features voice control compatibility and energy usage reports.</p>',
    vendor: 'SmartHome Innovations',
    product_type: 'Smart Home Devices',
    tags: ['smart home', 'thermostat', 'energy saving', 'iot'],
    images: [{ src: 'https://picsum.photos/seed/thermostat_shopify/600/600', altText: 'Smart thermostat' }],
  },
  {
    id: 'gid://shopify/Product/2345678901',
    handle: 'audiophile-pro-headphones',
    title: 'AuraSound Audiophile Pro Headphones',
    body_html: '<p>Immerse yourself in pure sound with the <strong>AuraSound Audiophile Pro</strong>. Featuring planar magnetic drivers for exceptional clarity and a wide soundstage. Open-back design for a natural audio experience.</p>',
    vendor: 'AuraSound Audio',
    product_type: 'Audio Equipment',
    tags: ['headphones', 'audio', 'hifi', 'audiophile'],
    images: [{ src: 'https://picsum.photos/seed/headphones_shopify/600/600', altText: 'Audiophile headphones' }],
  },
];

export const MOCK_SHOPIFY_ARTICLES: ShopifyArticle[] = [
  {
    id: 'gid://shopify/Article/1122334455',
    handle: 'benefits-of-eco-friendly-yoga-mats',
    title: 'Why Your Next Yoga Mat Should Be Eco-Friendly',
    body_html: '<p>Dive deep into the benefits of choosing sustainable materials for your yoga practice. Not only are they better for the planet, but they can also offer superior performance and durability. Learn what to look for in an eco-friendly yoga mat.</p>',
    excerpt_html: '<p>Discover the advantages of sustainable yoga mats for your practice and the environment.</p>',
    blog_title: 'Wellness & Yoga Journal',
    author_name: 'Dr. Eartha Love',
    tags: ['yoga', 'sustainability', 'eco-friendly', 'fitness gear'],
    image: { src: 'https://picsum.photos/seed/yogaarticle_shopify/600/400', altText: 'Yoga practice in nature' },
  },
  {
    id: 'gid://shopify/Article/6677889900',
    handle: 'smart-thermostats-energy-saving-guide',
    title: 'Slash Your Energy Bills: A Guide to Smart Thermostats',
    body_html: '<p>Smart thermostats are more than just a convenience; they are powerful tools for energy conservation. This guide explains how they work, the key features to look for, and tips for maximizing your energy savings.</p>',
    excerpt_html: '<p>Learn how smart thermostats can significantly reduce your home energy consumption.</p>',
    blog_title: 'Tech & Home Today',
    author_name: 'Tom Powers',
    tags: ['smart home', 'energy efficiency', 'thermostats', 'home tech'],
    image: { src: 'https://picsum.photos/seed/smartarticle_shopify/600/400', altText: 'Smartphone controlling thermostat' },
  },
  {
    id: 'gid://shopify/Article/3344556677',
    handle: 'introduction-to-hifi-audio',
    title: 'Beginner\'s Journey into High-Fidelity Audio',
    body_html: '<p>New to the world of HiFi audio? This article breaks down the basics, from understanding audio formats and equipment (like headphones and DACs) to setting up your first audiophile-grade listening experience. Prepare to hear music like never before.</p>',
    excerpt_html: '<p>A guide for newcomers to understand and appreciate high-fidelity audio.</p>',
    blog_title: 'SoundScapes Blog',
    author_name: 'Clara Nett',
    tags: ['audio', 'hifi', 'headphones', 'music technology', 'audiophile'],
    image: { src: 'https://picsum.photos/seed/audioarticle_shopify/600/400', altText: 'High-fidelity audio setup' },
  },
  {
    id: 'gid://shopify/Article/9988776655',
    handle: 'mastering-yoga-poses-for-beginners',
    title: '10 Essential Yoga Poses for Beginners (and How to Master Them)',
    body_html: '<p>Starting your yoga journey? These 10 foundational poses will build your strength, flexibility, and confidence. Detailed instructions and tips for proper alignment are included. Perfect for practice at home with your new mat!</p>',
    excerpt_html: '<p>A step-by-step guide to essential yoga poses, ideal for beginners practicing at home.</p>',
    blog_title: 'Wellness & Yoga Journal',
    author_name: 'Anjali Sharma',
    tags: ['yoga', 'beginners guide', 'fitness', 'home workout'],
    image: { src: 'https://picsum.photos/seed/yogaposes_shopify/600/400', altText: 'Person doing a yoga pose' },
  }
];

export const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
