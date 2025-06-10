import React from 'react';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="bg-red-800 border-l-4 border-red-500 text-red-100 p-6 rounded-md shadow-md" role="alert">
      <p className="font-bold text-lg">Oops! Something went wrong.</p>
      <p className="mt-1">{message}</p>
    </div>
  );
};

export default ErrorMessage;