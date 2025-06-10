
import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import ChatMessageItem from './ChatMessageItem';
import ChatInput from './ChatInput';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string) => void;
  isAiResponding: boolean;
  storeDisplayName: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isAiResponding, storeDisplayName }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-b-xl overflow-hidden"> {/* Ensure bottom rounding if header is separate */}
      {/* Header removed from here, as App.tsx's Header will be part of the floating widget window */}
      <div className="flex-grow p-3 space-y-3 overflow-y-auto"> {/* Adjusted padding */}
        {messages.map((msg) => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
        {isAiResponding && messages[messages.length-1]?.sender === 'user' && (
           <ChatMessageItem message={{id: 'ai-typing', sender: 'ai', text: 'Typing...', timestamp: new Date()}} />
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-slate-700 bg-slate-850"> {/* Adjusted padding */}
        <ChatInput onSendMessage={onSendMessage} disabled={isAiResponding} />
      </div>
    </div>
  );
};

export default ChatInterface;
    