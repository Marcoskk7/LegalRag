import { Send, Sparkles, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Spin } from 'antd';
import { streamChat } from '../chatService';
import { ChatMessage, GroundingMetadata } from '../typing';
import './ChatPanel.less';

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    // Prepare history for API
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    history.push({ role: 'user', content: userMsg.content });

    // Initial assistant message placeholder
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isLoading: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const generator = streamChat({
        messages: history,
        temperature: 0.2,
      });

      for await (const event of generator) {
        if (event.type === 'text_chunk') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + event.text }
                : msg,
            ),
          );
        } else if (event.type === 'grounding_metadata') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, groundingMetadata: event.data }
                : msg,
            ),
          );
        } else if (event.type === 'error') {
          console.error('Chat error:', event.message);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + `\n\n[Error: ${event.message}]` }
                : msg,
            ),
          );
        } else if (event.type === 'done') {
           // Finished
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, isLoading: false } : msg,
        ),
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderGroundingCards = (metadata?: GroundingMetadata) => {
    if (!metadata?.urls || metadata.urls.length === 0) return null;
    
    // Prefer grounding_chunks if available for titles, otherwise fallback to urls
    const links = metadata.urls.map((url, index) => {
        const chunk = metadata.grounding_chunks?.find(c => c.web.uri === url);
        const title = chunk?.web.title || new URL(url).hostname;
        return { url, title };
    });

    // Remove duplicates based on URL
    const uniqueLinks = Array.from(new Map(links.map(item => [item.url, item])).values());

    return (
      <div className="grounding-cards">
        {uniqueLinks.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="vercel-link-card"
          >
            <div className="card-title" title={link.title}>{link.title}</div>
            <div className="card-url" title={link.url}>{link.url}</div>
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>有什么我可以帮您的吗？</p>
            <p className="text-sm opacity-70">您可以询问关于合同条款、风险或法律依据的问题。</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
             <div className="flex flex-row items-end gap-2">
                {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                        <Sparkles size={14} className="text-brand-400" />
                    </div>
                )}
                
                <div className="flex flex-col max-w-full">
                    <div className="message-content whitespace-pre-wrap">
                      {msg.content}
                      {msg.isLoading && (
                        <span className="inline-block w-2 h-4 ml-1 align-middle bg-brand-400 animate-pulse"/>
                      )}
                    </div>
                    {msg.role === 'assistant' && renderGroundingCards(msg.groundingMetadata)}
                </div>

                {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                        <User size={14} className="text-slate-300" />
                    </div>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={isLoading}
          />
          <Button
            type="primary"
            icon={<Send size={16} />}
            onClick={handleSendMessage}
            loading={isLoading}
            className="!bg-brand-600 !flex !items-center !justify-center !h-auto"
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;

