'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PaperPlaneRight,
  CircleNotch,
  User,
  Robot,
  Microphone,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabaseClient';
import { useCompany } from '@/app/company-context';
import { format } from 'date-fns';
import { sl } from 'date-fns/locale';

interface Message {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: DataCard[] | null;
  actions?: QuickAction[] | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

interface DataCard {
  title: string;
  value: string;
  type?: string;
}

interface QuickAction {
  type: string;
  label: string;
  value: string;
}

const FALLBACK_MESSAGE = 'Oprostite, nisem mogel obdelati vašega sporočila.';

const normalizeContentValue = (value: unknown): string | null => {
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    const parts = value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const record = part as Record<string, unknown>;
          if (typeof record.text === 'string') return record.text;
          if (typeof record.content === 'string') return record.content;
        }
        return '';
      })
      .filter(Boolean);

    if (parts.length > 0) return parts.join('');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.content === 'string') return record.content;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.message === 'string') return record.message;
    if (record.message && typeof record.message === 'object') {
      const nested = record.message as Record<string, unknown>;
      if (typeof nested.content === 'string') return nested.content;
      if (typeof nested.text === 'string') return nested.text;
    }
  }

  return null;
};

const extractMessageContent = (result: unknown): string => {
  if (typeof result === 'string') return result;

  if (Array.isArray(result)) {
    const fromArray = normalizeContentValue(result);
    if (fromArray) return fromArray;
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    const candidates = [record.content, record.message, record.text];

    for (const candidate of candidates) {
      const normalized = normalizeContentValue(candidate);
      if (normalized) return normalized;
    }
  }

  return FALLBACK_MESSAGE;
};

// Generate unique IDs
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Smart suggestions for empty state
const SMART_SUGGESTIONS = [
  { label: 'Kateri termini so danes?', value: 'termini_danes' },
  { label: 'Prikaži statistike', value: 'statistike' },
  { label: 'Najdi stranko', value: 'najdi_stranko' },
];

export function AssistantChat({ sessionId }: { sessionId: string }) {
  const { companyId, companySettings } = useCompany();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track if user has interacted (to hide welcome state)
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!companyId) return;
    // Simply finish loading - no welcome message added to messages array
    setInitialLoading(false);
  }, [companyId, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading || !companyId) return;

    setInput('');
    setLoading(true);

    try {
      // Create user message
      const userMsg: Message = {
        message_id: generateId(),
        role: 'user',
        content: textToSend,
        created_at: new Date().toISOString(),
      };

      // Add to UI immediately
      setMessages((prev) => [...prev, userMsg]);

      // Call AI API
      const assistantResponse = await getAIResponse(textToSend);

      // Create assistant message
      const assistantMsg: Message = {
        message_id: generateId(),
        role: 'assistant',
        content: assistantResponse.content,
        cards: assistantResponse.cards,
        actions: assistantResponse.actions,
        meta: assistantResponse.meta,
        created_at: new Date().toISOString(),
      };

      // Add to UI
      setMessages((prev) => [...prev, assistantMsg]);

    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMsg: Message = {
        message_id: generateId(),
        role: 'assistant',
        content: 'Oprostite, prišlo je do napake. Prosimo, poskusite znova.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const getAIResponse = async (
    userMessage: string
  ): Promise<{
    content: string;
    cards: DataCard[] | null;
    actions: QuickAction[] | null;
    meta: Record<string, unknown> | null;
  }> => {
    try {
      // Prepare context data for the AI
      const companyName = companySettings?.['Naziv Podjetja'] || 'Podjetje';
      const chatInstructions = companySettings?.['chat_instructions'] || '';
      const chatTone = companySettings?.['chat_tone'] || 'prijazen in profesionalen';

      // Fetch relevant context based on the query
      let contextData: Record<string, unknown> = {};
      const lowerMessage = userMessage.toLowerCase();

      // Fetch appointments if relevant
      if (
        lowerMessage.includes('termin') ||
        lowerMessage.includes('danes') ||
        lowerMessage.includes('jutri') ||
        lowerMessage.includes('razpored') ||
        lowerMessage.includes('koledar')
      ) {
        const today = new Date();
        const { data: appointments } = await supabase
          .from('Termini')
          .select('*')
          .eq('ID podjetja', companyId)
          .gte('Datum', today.toISOString().split('T')[0])
          .order('Datum', { ascending: true })
          .limit(10);

        contextData.appointments = appointments || [];
      }

      // Fetch clients if relevant
      if (
        lowerMessage.includes('stranka') ||
        lowerMessage.includes('kontakt') ||
        lowerMessage.includes('najdi') ||
        lowerMessage.includes('klient')
      ) {
        const { data: clients } = await supabase
          .from('Stranke')
          .select('*')
          .eq('ID Podjetja', companyId)
          .limit(20);

        contextData.clients = clients || [];
      }

      // Fetch services if relevant
      if (
        lowerMessage.includes('storitev') ||
        lowerMessage.includes('cena') ||
        lowerMessage.includes('cenik')
      ) {
        const { data: services } = await supabase
          .from('Storitve')
          .select('*')
          .eq('ID podjetja', companyId)
          .eq('aktivna', true);

        contextData.services = services || [];
      }

      // Fetch statistics if relevant
      if (
        lowerMessage.includes('statistik') ||
        lowerMessage.includes('prihodek') ||
        lowerMessage.includes('analiz')
      ) {
        const { count: appointmentCount } = await supabase
          .from('Termini')
          .select('*', { count: 'exact', head: true })
          .eq('ID podjetja', companyId);

        const { count: clientCount } = await supabase
          .from('Stranke')
          .select('*', { count: 'exact', head: true })
          .eq('ID Podjetja', companyId);

        contextData.statistics = {
          totalAppointments: appointmentCount || 0,
          totalClients: clientCount || 0,
        };
      }

      // Get chat history for context
      const recentMessages = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Build the prompt payload
      const promptPayload = {
        system: `Ti si AI asistent za podjetje ${companyName}.
${chatInstructions}
Ton komunikacije: ${chatTone}

PRAVILA:
- Vedno odgovarjaj v slovenščini
- Uporabljaj podjetniške podatke za odgovarjanje
- Predlagaj akcije, ko je primerno
- Če ti manjkajo podatki, vljudno vprašaj za več informacij
- Lahko predlagaš ustvarjanje terminov in strank`,
        history: recentMessages,
        user: userMessage,
        context: contextData,
        metadata: {
          company_id: companyId,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to n8n webhook
      const response = await fetch('https://tikej.app.n8n.cloud/webhook/asistent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptPayload,
          session_id: sessionId,
          company_id: companyId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      const result = await response.json();

      // Parse the response from n8n
      return {
        content: extractMessageContent(result),
        cards: result.cards || null,
        actions: result.actions || null,
        meta: result.meta || { intent: result.intent },
      };
    } catch (error) {
      console.error('AI Response error:', error);

      // Fallback to local mock responses if webhook fails
      return getFallbackResponse(userMessage);
    }
  };

  const getFallbackResponse = async (
    userMessage: string
  ): Promise<{
    content: string;
    cards: DataCard[] | null;
    actions: QuickAction[] | null;
    meta: Record<string, unknown> | null;
  }> => {
    const lowerMessage = userMessage.toLowerCase();

    // Check for appointment queries
    if (
      lowerMessage.includes('termin') ||
      lowerMessage.includes('danes') ||
      lowerMessage.includes('jutri') ||
      lowerMessage.includes('razpored')
    ) {
      const today = new Date().toISOString().split('T')[0];
      const { data: appointments } = await supabase
        .from('Termini')
        .select('*')
        .eq('ID podjetja', companyId)
        .eq('Datum', today)
        .order('Ura', { ascending: true })
        .limit(5);

      if (appointments && appointments.length > 0) {
        const cards: DataCard[] = appointments.map((apt) => ({
          title: `${apt.Ura || ''} - Termin`,
          value: apt.Status || 'V obdelavi',
          type: 'appointment',
        }));

        return {
          content: `Danes imate **${appointments.length} termin${appointments.length > 1 ? 'ov' : ''}**:`,
          cards,
          actions: [
            { type: 'quick_reply', label: 'Termini za jutri', value: 'termini_jutri' },
          ],
          meta: { intent: 'appointments_today', count: appointments.length },
        };
      } else {
        return {
          content: 'Danes nimate nobenih terminov.',
          cards: null,
          actions: [
            { type: 'quick_reply', label: 'Termini za jutri', value: 'termini_jutri' },
          ],
          meta: { intent: 'appointments_today', count: 0 },
        };
      }
    }

    // Check for statistics queries
    if (
      lowerMessage.includes('statistik') ||
      lowerMessage.includes('prihodek') ||
      lowerMessage.includes('analiz')
    ) {
      const { count: appointmentCount } = await supabase
        .from('Termini')
        .select('*', { count: 'exact', head: true })
        .eq('ID podjetja', companyId);

      const { count: clientCount } = await supabase
        .from('Stranke')
        .select('*', { count: 'exact', head: true })
        .eq('ID Podjetja', companyId);

      return {
        content: 'Tukaj so osnovne statistike vašega podjetja:',
        cards: [
          { title: 'Skupno terminov', value: String(appointmentCount || 0), type: 'stat' },
          { title: 'Skupno strank', value: String(clientCount || 0), type: 'stat' },
        ],
        actions: [],
        meta: { intent: 'statistics' },
      };
    }

    // Default response
    return {
      content: `Razumem vaše vprašanje. Kako vam lahko pomagam?`,
      cards: null,
      actions: [
        { type: 'quick_reply', label: 'Termini danes', value: 'termini_danes' },
        { type: 'quick_reply', label: 'Statistike', value: 'statistike' },
      ],
      meta: { intent: 'general' },
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSuggestionClick = (suggestion: { label: string; value: string }) => {
    sendMessage(suggestion.label);
  };

  if (initialLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <CircleNotch className="w-8 h-8 text-violet-500" weight="bold" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-4">
        {/* Welcome State - Only show when no messages */}
        <AnimatePresence>
          {!hasMessages && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center h-full py-12"
            >
              {/* Assistant Avatar with Online Indicator */}
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="w-16 h-16 rounded-2xl p-[2px] shadow-xl shadow-violet-500/30"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                  }}
                >
                  <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                    <Robot
                      className="w-9 h-9"
                      weight="fill"
                      style={{
                        background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    />
                  </div>
                </motion.div>
                {/* Online Status Dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 500 }}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white shadow-md"
                />
              </div>

              {/* Single Sentence Welcome Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-white to-violet-50/50 rounded-2xl border border-violet-100/50 shadow-lg shadow-violet-500/5 p-6 max-w-md text-center"
              >
                <p className="text-gray-700 text-base leading-relaxed">
                  Sem Asistent+ — lahko preverim termine, vpišem nov termin ali dodam stranko.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actual Messages */}
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <MessageBubble
              key={message.message_id}
              message={message}
              onQuickAction={(action) => sendMessage(action.label)}
              delay={index * 0.05}
            />
          ))}
        </AnimatePresence>

        {/* Loading Indicator - iOS style */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2"
          >
            {/* Avatar with Online Indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <Robot className="w-4 h-4 text-white" weight="fill" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex flex-col items-start">
              <motion.div
                className="inline-block px-4 py-2.5 bg-gray-100 rounded-2xl rounded-bl-md"
                animate={{
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-2 h-2 bg-gray-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-gray-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-gray-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Smart Suggestions - Only show when chat is empty */}
      <AnimatePresence>
        {!hasMessages && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-2 flex flex-wrap justify-center gap-2"
          >
            {SMART_SUGGESTIONS.map((suggestion, idx) => (
              <motion.button
                key={suggestion.value}
                onClick={() => handleSuggestionClick(suggestion)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md hover:border-violet-200 transition-all"
                style={{
                  background: 'white',
                }}
              >
                <span
                  style={{
                    background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {suggestion.label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Voice button - DISABLED with gradient icon */}
          <button
            type="button"
            disabled
            className="h-12 w-12 flex items-center justify-center rounded-xl border border-gray-200 bg-white opacity-50 cursor-not-allowed flex-shrink-0"
            title="Glasovno sporočilo (kmalu na voljo)"
          >
            <Microphone
              className="w-5 h-5"
              weight="fill"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            />
          </button>

          {/* Input field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Vprašajte me karkoli..."
            className="flex-1 h-12 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all text-base placeholder:text-gray-400"
            disabled={loading}
          />

          {/* Send button */}
          <motion.button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 flex-shrink-0"
          >
            {loading ? (
              <CircleNotch className="w-5 h-5 animate-spin" weight="bold" />
            ) : (
              <PaperPlaneRight className="w-5 h-5" weight="fill" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component - iOS SMS Style
function MessageBubble({
  message,
  onQuickAction,
  delay = 0,
}: {
  message: Message;
  onQuickAction: (action: QuickAction) => void;
  delay?: number;
}) {
  const isUser = message.role === 'user';
  const contentText = extractMessageContent(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        delay
      }}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {isUser ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, delay: delay + 0.1 }}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200"
        >
          <User className="w-4 h-4 text-gray-600" weight="fill" />
        </motion.div>
      ) : (
        <div className="relative flex-shrink-0">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, delay: delay + 0.1 }}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-cyan-500"
          >
            <Robot className="w-4 h-4 text-white" weight="fill" />
          </motion.div>
          {/* Online Status Dot for Assistant */}
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
        </div>
      )}

      {/* Message Content & Timestamp Container */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Bubble - iOS SMS style */}
        <motion.div
          initial={{ opacity: 0, x: isUser ? 10 : -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.05 }}
          className={`inline-block px-4 py-2.5 ${
            isUser
              ? 'rounded-2xl rounded-br-md text-white'
              : 'bg-gray-100 rounded-2xl rounded-bl-md text-gray-900'
          }`}
          style={isUser ? {
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 35%, #3B82F6 65%, #06B6D4 100%)',
          } : undefined}
        >
          {/* Text Content - render markdown-like formatting */}
          <div className={`text-[15px] leading-relaxed ${isUser ? 'text-white' : 'text-gray-900'}`}>
            {contentText.split('\n').map((line, i) => (
              <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                {line.split('**').map((part, j) =>
                  j % 2 === 1 ? (
                    <strong key={j} className="font-semibold">{part}</strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
            ))}
          </div>
        </motion.div>

        {/* Data Cards - Outside bubble for assistant */}
        {!isUser && message.cards && message.cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full"
          >
            {message.cards.map((card, idx) => (
              <DataCardComponent key={idx} card={card} delay={delay + 0.25 + idx * 0.05} />
            ))}
          </motion.div>
        )}

        {/* Quick Actions - Outside bubble for assistant */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + 0.3 }}
            className="mt-2 flex flex-wrap gap-2"
          >
            {message.actions.map((action, idx) => (
              <motion.button
                key={idx}
                onClick={() => onQuickAction(action)}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-full shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-shadow"
              >
                {action.label}
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Timestamp - Outside bubble, iOS style */}
        <div className={`mt-1 text-[11px] text-gray-400 ${isUser ? 'mr-1' : 'ml-1'}`}>
          {format(new Date(message.created_at), 'HH:mm', { locale: sl })}
        </div>
      </div>
    </motion.div>
  );
}

// Data Card Component with Premium Design
function DataCardComponent({ card, delay = 0 }: { card: DataCard; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="p-3 bg-gradient-to-br from-violet-50 to-cyan-50 rounded-xl border border-violet-200/50 shadow-sm hover:shadow-md transition-shadow cursor-default"
    >
      <div className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">{card.title}</div>
      <div className="text-sm text-gray-800 font-medium">{card.value}</div>
    </motion.div>
  );
}
