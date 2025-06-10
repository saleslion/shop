import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-10">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sky-400"></div>
      <p className="mt-4 text-sky-400 font-semibold text-lg">Fetching AI Advice...</p>
    </div>
  );
};

export default LoadingSpinner;