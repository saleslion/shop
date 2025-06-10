
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Corrected path: App.tsx is in the root directory
import './src/index.css'; // This path is correct as index.css is in src/

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);