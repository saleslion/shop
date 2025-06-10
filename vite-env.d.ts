
// Removed /// <reference types="vite/client" /> as it was causing a TypeScript error
// and Vite client types are not expected to be present in this project configuration.

interface ImportMetaEnv {
  // Define your Vite environment variables here
  readonly VITE_HIFISTI_STOREFRONT_API_TOKEN: string | undefined;
  // e.g., readonly VITE_SOME_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
