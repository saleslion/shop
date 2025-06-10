
import React from 'react';

// connectedStoreName prop is removed
const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 p-4 shadow-md"> {/* Reduced padding for widget view */}
      <div className="container mx-auto flex flex-col sm:flex-row justify-center items-center"> {/* Centered for widget header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-sky-400">Hifisti AI Advisor</h1>
          {/* Subtitle can be removed or simplified for widget view
          <p className="mt-1 text-xs text-slate-300">AI-powered insights</p> 
          */}
        </div>
        {/* Connected store display is removed */}
      </div>
    </header>
  );
};

export default Header;
    