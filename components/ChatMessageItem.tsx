import React from 'react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="my-2 text-center">
        <p className="text-xs text-slate-400 italic px-2 py-1 bg-slate-700 rounded-full inline-block">
          {message.text}
        </p>
      </div>
    );
  }
  
  const renderMessageText = (text: string) => {
    // Regex to find URLs (http, https)
    const urlRegex = /(\bhttps?:\/\/[^\s<>"'`]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sky-400 hover:text-sky-300 underline hover:font-semibold" // Adjusted link color for dark theme
          >
            {part}
          </a>
        );
      }
      // Handle newlines within non-URL parts
      return part.split('\n').map((line, lineIndex, arr) => (
        <React.Fragment key={`${index}-${lineIndex}`}>
          {line}
          {lineIndex < arr.length - 1 && <br />}
        </React.Fragment>
      ));
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-xl shadow ${
          isUser 
            ? 'bg-sky-700 text-slate-100' // Darker blue for user
            : 'bg-slate-600 text-slate-100' // Darker gray/slate for AI
        } ${message.id === 'ai-typing' ? 'opacity-70 italic bg-slate-500' : ''}`}
      >
        <div className="text-sm whitespace-pre-wrap">{renderMessageText(message.text)}</div>
        {! (message.id === 'ai-typing') && (
            <p className={`text-xs mt-1 ${isUser ? 'text-sky-200 text-right' : 'text-slate-300 text-left'} opacity-80`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
        )}
      </div>
    </div>
  );
};

export default ChatMessageItem;