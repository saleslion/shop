import React, { useState } from 'react';
import { FiSend } from 'react-icons/fi'; // Using react-icons

interface ChatInputProps {
  onSendMessage: (messageText: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled }) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !disabled) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Ask about products, categories, or get advice..."
        className="form-input flex-grow"
        disabled={disabled}
        aria-label="Type your message"
      />
      <button 
        type="submit" 
        className="button-primary p-3" 
        disabled={disabled || !inputText.trim()}
        aria-label="Send message"
      >
        <FiSend size={20} />
      </button>
    </form>
  );
};

export default ChatInput;
