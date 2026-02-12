'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PaperPlaneTilt, ChatCircle } from '@phosphor-icons/react';

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: string;
  actions?: { label: string; variant: 'primary' | 'secondary' }[];
}

interface ChatbotPreviewProps {
  botName?: string;
  greeting?: string;
}

const DEMO_CONVERSATION: Message[] = [
  {
    id: '1',
    text: 'Pozdravljeni! Sem vaš AI asistent. Kako vam lahko pomagam danes?',
    sender: 'bot',
    timestamp: '10:00',
    actions: [
      { label: 'Rezerviraj termin', variant: 'primary' },
      { label: 'Informacije o storitvah', variant: 'secondary' },
    ],
  },
  {
    id: '2',
    text: 'Rad bi rezerviral termin za striženje.',
    sender: 'user',
    timestamp: '10:01',
  },
  {
    id: '3',
    text: 'Odlično! Za striženje imamo proste termine v naslednjih dneh. Kateri dan vam ustreza?',
    sender: 'bot',
    timestamp: '10:01',
    actions: [
      { label: 'Potrdi', variant: 'primary' },
      { label: 'Spremeni', variant: 'secondary' },
    ],
  },
  {
    id: '4',
    text: 'Jutri popoldne bi bilo idealno.',
    sender: 'user',
    timestamp: '10:02',
  },
  {
    id: '5',
    text: 'Imam prosti termin jutri ob 14:00 ali 16:30. Kateri vam bolj ustreza?',
    sender: 'bot',
    timestamp: '10:02',
  },
];

const SUGGESTIONS = ['Prosti termini', 'Cenik storitev', 'Delovni čas', 'Lokacija'];

const springBounce = { type: 'spring' as const, stiffness: 400, damping: 25 };

export function ChatbotPreview({ botName = 'Chatbot+', greeting }: ChatbotPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [unreadCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, messages.length]);

  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      // Show messages one by one with delay
      DEMO_CONVERSATION.forEach((msg, i) => {
        setTimeout(() => {
          setMessages(prev => [...prev, msg]);
        }, i * 600);
      });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, newMsg]);
    setInputValue('');

    // Bot auto-reply
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'Hvala za sporočilo! To je predogled chatbota. V produkciji bi tukaj odgovoril AI asistent.',
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      text: suggestion,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const isWelcomeScreen = messages.length === 0;

  return (
    <div className="relative">
      {/* Chatbot Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={springBounce}
            className="w-[420px] max-h-[650px] rounded-3xl bg-white overflow-hidden flex flex-col"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 12px 24px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            }}
          >
            {/* Header */}
            <div className="relative px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    }}
                  >
                    <ChatCircle className="w-6 h-6 text-white" weight="fill" />
                    {/* Shine animation */}
                    <div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 45%, transparent 50%)',
                        animation: 'shine 3s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>

                <div className="flex-1">
                  {/* Bot name */}
                  <h3 className="text-lg font-bold text-gray-900">{botName}</h3>
                  {/* Online status */}
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-sm text-gray-500">Na voljo</span>
                  </div>
                </div>

                {/* Close button */}
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" weight="bold" />
                </motion.button>
              </div>
              {/* Bottom gradient line */}
              <div
                className="absolute bottom-0 left-5 right-5 h-px"
                style={{
                  background: 'linear-gradient(90deg, transparent, #8B5CF6, #3B82F6, #06B6D4, transparent)',
                }}
              />
            </div>

            {/* Messages area */}
            <div
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
              style={{
                maxHeight: 'calc(650px - 200px)',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0,0,0,0.1) transparent',
              }}
            >
              {isWelcomeScreen ? (
                /* Welcome screen */
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    }}
                  >
                    <ChatCircle className="w-9 h-9 text-white" weight="fill" />
                  </motion.div>
                  <h3 className="text-[22px] font-bold text-gray-900 mb-2">
                    {greeting || `Pozdravljeni!`}
                  </h3>
                  <p className="text-[15px] text-gray-500 text-center max-w-[280px]">
                    Sem vaš AI asistent. Vprašajte me karkoli o naših storitvah ali rezervirajte termin.
                  </p>
                </div>
              ) : (
                /* Messages */
                <>
                  {messages.map((msg, index) => (
                    <motion.div
                      key={msg.id}
                      initial={{
                        opacity: 0,
                        x: msg.sender === 'user' ? 20 : -20,
                        scale: 0.95,
                      }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ ...springBounce, delay: 0.05 }}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[85%] space-y-1">
                        <motion.div
                          whileHover={{ scale: 1.01 }}
                          className={`px-4 py-3 text-sm leading-relaxed ${
                            msg.sender === 'user'
                              ? 'rounded-2xl rounded-br-md text-white'
                              : 'rounded-2xl rounded-bl-md text-gray-800 bg-white/80 backdrop-blur-sm border border-gray-100'
                          }`}
                          style={
                            msg.sender === 'user'
                              ? {
                                  background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                                }
                              : {
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                }
                          }
                        >
                          {msg.text}
                        </motion.div>

                        {/* Timestamp */}
                        <p
                          className={`text-[11px] text-gray-400 px-1 ${
                            msg.sender === 'user' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {msg.timestamp}
                        </p>

                        {/* Action buttons */}
                        {msg.actions && msg.sender === 'bot' && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-wrap gap-2 mt-1"
                          >
                            {msg.actions.map((action, actionIdx) => (
                              <motion.button
                                key={actionIdx}
                                whileHover={{ y: -1, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all ${
                                  action.variant === 'primary'
                                    ? 'text-white shadow-md hover:shadow-lg'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                                style={
                                  action.variant === 'primary'
                                    ? {
                                        background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                      }
                                    : undefined
                                }
                              >
                                {action.label}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Suggestions */}
                  {messages.length > 0 && messages.length <= 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex flex-wrap gap-2 pt-2"
                    >
                      {SUGGESTIONS.map((suggestion, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          whileHover={{ y: -2, scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="px-3.5 py-2 rounded-2xl text-xs font-medium text-gray-600 bg-white/80 backdrop-blur-sm border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                        >
                          {suggestion}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Composer / Input area */}
            <div className="px-5 py-4 border-t border-gray-100">
              <div
                className="flex items-center gap-2 rounded-3xl bg-white border-2 border-gray-200 px-4 py-1 transition-all focus-within:border-violet-400 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.1)]"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Napišite sporočilo..."
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none py-2.5"
                />
                <motion.button
                  onClick={handleSend}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={!inputValue.trim()}
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
                  style={{
                    background: inputValue.trim()
                      ? 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)'
                      : '#E5E7EB',
                  }}
                >
                  <PaperPlaneTilt
                    className={`w-5 h-5 ${inputValue.trim() ? 'text-white' : 'text-gray-400'}`}
                    weight="fill"
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
            }}
          >
            {/* Pulsing glow */}
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
              }}
            />

            <motion.div
              whileHover={{
                rotate: [0, -10, 10, -10, 0],
                transition: { duration: 0.5 },
              }}
            >
              <svg width="28" height="28" viewBox="0 0 256 256" fill="white">
                <path d="M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78.69.69,0,0,0,.13-.11L82.5,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM216,192H82.5a16,16,0,0,0-10.3,3.75l-.12.11L40,224V64H216Z" />
              </svg>
            </motion.div>

            {/* Unread badge */}
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center px-1.5 text-[11px] font-bold text-white bg-red-500 rounded-full shadow-lg"
              >
                {unreadCount}
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes shine {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
