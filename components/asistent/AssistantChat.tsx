'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CircleNotch,
  ArrowUp,
  Microphone,
  CalendarBlank,
  ChartBar,
  CalendarPlus,
  MagnifyingGlass,
  PaperPlaneTilt,
  SquaresFour,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabaseClient';
import { useCompany } from '@/app/company-context';
import { format } from 'date-fns';
import { sl } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

const FALLBACK_MESSAGE = 'Oprostite, nisem mogel obdelati vašega sporočila.';

const QUICK_ACTIONS = [
  { label: 'Kateri termini so danes?', icon: CalendarBlank },
  { label: 'Prikaži statistike', icon: ChartBar },
  { label: 'Najdi stranko', icon: MagnifyingGlass },
  { label: 'Dodaj nov termin', icon: CalendarPlus },
  { label: 'Pošlji sporočilo', icon: PaperPlaneTilt },
  { label: 'Današnji pregled', icon: SquaresFour },
];

// ============================================================================
// Helper Functions
// ============================================================================

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

// ============================================================================
// Gradient Defs — hidden SVG paint server referenced by all icons
// ============================================================================

function GradientDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="asistentIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ============================================================================
// Avatar components
// ============================================================================

function AssistantAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
      style={{
        border: '2px solid transparent',
        backgroundImage:
          'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      }}
    >
      <span
        className="text-xs font-semibold leading-none"
        style={{
          background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        A+
      </span>
    </div>
  );
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
      style={{
        border: '2px solid transparent',
        backgroundImage:
          'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      }}
    >
      <span
        className="text-xs font-semibold leading-none"
        style={{
          background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {initials}
      </span>
    </div>
  );
}

// ============================================================================
// Quick Action Chip
// ============================================================================

function QuickActionChip({
  label,
  icon: Icon,
  delay = 0,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  delay?: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 28 }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-gray-700 transition-shadow"
      style={{
        background: hovered ? 'rgba(139, 92, 246, 0.06)' : 'rgba(255, 255, 255, 0.85)',
        border: hovered
          ? '1px solid rgba(139, 92, 246, 0.35)'
          : '1px solid rgba(139, 92, 246, 0.2)',
        backdropFilter: 'blur(10px)',
        boxShadow: hovered
          ? '0 4px 16px rgba(139, 92, 246, 0.14)'
          : '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* Phosphor icon using the shared SVG gradient paint server */}
      <Icon size={17} color="url(#asistentIconGrad)" weight="fill" />
      <span>{label}</span>
    </motion.button>
  );
}

// ============================================================================
// Message Bubble
// ============================================================================

function MessageBubble({
  message,
  onQuickAction,
  delay = 0,
  userInitials,
}: {
  message: Message;
  onQuickAction: (action: QuickAction) => void;
  delay?: number;
  userInitials: string;
}) {
  const isUser = message.role === 'user';
  const contentText = extractMessageContent(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, delay }}
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {isUser ? <UserAvatar initials={userInitials} /> : <AssistantAvatar />}

      {/* Message content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] gap-1`}>
        {/* Bubble */}
        <div
          className={`inline-block px-4 py-3 ${
            isUser ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'
          }`}
          style={
            isUser
              ? {
                  background:
                    'linear-gradient(135deg, #8B5CF6 0%, #6366F1 35%, #3B82F6 65%, #06B6D4 100%)',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                }
              : {
                  background: 'white',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                }
          }
        >
          <div className={`text-[15px] leading-relaxed ${isUser ? 'text-white' : 'text-gray-900'}`}>
            {contentText.split('\n').map((line, i) => (
              <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                {line.split('**').map((part, j) =>
                  j % 2 === 1 ? (
                    <strong
                      key={j}
                      className="font-semibold"
                      style={
                        !isUser
                          ? {
                              background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                            }
                          : undefined
                      }
                    >
                      {part}
                    </strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
            ))}
          </div>
        </div>

        {/* Data Cards */}
        {!isUser && message.cards && message.cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-1"
          >
            {message.cards.map((card, idx) => (
              <DataCardComponent key={idx} card={card} delay={delay + 0.25 + idx * 0.05} />
            ))}
          </motion.div>
        )}

        {/* Follow-up action chips from assistant */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + 0.3 }}
            className="flex flex-wrap gap-2 mt-1"
          >
            {message.actions.map((action, idx) => (
              <motion.button
                key={idx}
                onClick={() => onQuickAction(action)}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)',
                }}
              >
                {action.label}
              </motion.button>
            ))}
          </motion.div>
        )}


        {/* Timestamp */}
        <div className={`text-[11px] text-gray-400 ${isUser ? 'mr-1' : 'ml-1'}`}>
          {format(new Date(message.created_at), 'HH:mm', { locale: sl })}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Data Card
// ============================================================================

function DataCardComponent({ card, delay = 0 }: { card: DataCard; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="p-3 rounded-xl cursor-default"
      style={{
        background:
          'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(6, 182, 212, 0.06) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">
        {card.title}
      </div>
      <div className="text-sm text-gray-800 font-medium">{card.value}</div>
    </motion.div>
  );
}

// ============================================================================
// Typing Indicator
// ============================================================================

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-end gap-3"
    >
      <AssistantAvatar />
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-md"
        style={{
          background: 'white',
          border: '1px solid rgba(139, 92, 246, 0.1)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: '#8B5CF6',
              }}
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Shared Input Field
// ============================================================================

function ChatInput({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onSend,
  loading,
  focused,
  textareaRef,
  pill = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSend: () => void;
  loading: boolean;
  focused: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  pill?: boolean;
}) {
  const borderRadius = pill ? '9999px' : '16px';

  return (
    <div
      className="flex items-end gap-3 px-4 py-3 transition-all duration-200"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: focused
          ? '2px solid rgba(139, 92, 246, 0.4)'
          : '2px solid rgba(139, 92, 246, 0.15)',
        borderRadius,
        boxShadow: focused
          ? '0 0 0 4px rgba(139, 92, 246, 0.08), 0 4px 20px rgba(139, 92, 246, 0.12)'
          : '0 4px 20px rgba(139, 92, 246, 0.08)',
      }}
    >
      {/* Mic (disabled) */}
      <button
        type="button"
        disabled
        className="flex items-center justify-center text-gray-300 cursor-not-allowed flex-shrink-0 self-end mb-0.5"
        style={{ width: 32, height: 32 }}
        title="Glasovno sporočilo (kmalu na voljo)"
      >
        <Microphone className="w-4 h-4" weight="fill" />
      </button>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Vprašajte me karkoli..."
        className="flex-1 resize-none bg-transparent outline-none text-base text-gray-800 placeholder:text-gray-400 leading-relaxed self-center"
        rows={1}
        disabled={loading}
        style={{ minHeight: '28px', maxHeight: '200px' }}
      />

      {/* Send button */}
      <motion.button
        onClick={onSend}
        disabled={!value.trim() || loading}
        whileHover={value.trim() && !loading ? { scale: 1.1 } : {}}
        whileTap={value.trim() && !loading ? { scale: 0.9 } : {}}
        className="flex items-center justify-center rounded-xl transition-all flex-shrink-0 self-end"
        style={{
          width: 40,
          height: 40,
          background:
            value.trim() && !loading
              ? 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)'
              : '#E5E7EB',
          boxShadow:
            value.trim() && !loading ? '0 4px 12px rgba(139, 92, 246, 0.35)' : 'none',
        }}
      >
        {loading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <CircleNotch className="w-4 h-4" weight="bold" style={{ color: '#9CA3AF' }} />
          </motion.div>
        ) : (
          <ArrowUp
            className="w-4 h-4"
            weight="bold"
            style={{ color: value.trim() ? 'white' : '#9CA3AF' }}
          />
        )}
      </motion.button>
    </div>
  );
}

// ============================================================================
// Main AssistantChat Component
// ============================================================================

export function AssistantChat({
  sessionId,
  onNewSession,
  onShowInfo,
}: {
  sessionId: string;
  onNewSession?: () => void;
  onShowInfo?: () => void;
}) {
  const { companyId, companySettings } = useCompany();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [userInitials, setUserInitials] = useState('U');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setInitialLoading(false);
  }, [companyId, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Derive user initials from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name = (user.user_metadata?.full_name as string) || user.email || '';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        setUserInitials((parts[0][0] + parts[parts.length - 1][0]).toUpperCase());
      } else if (parts[0]?.length > 0) {
        setUserInitials(parts[0].slice(0, 2).toUpperCase());
      }
    });
  }, []);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || loading || !companyId) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Expand on first message
    if (!isExpanded) {
      setIsExpanded(true);
    }

    setLoading(true);

    try {
      const userMsg: Message = {
        message_id: generateId(),
        role: 'user',
        content: textToSend,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      const assistantResponse = await getAIResponse(textToSend);

      const assistantMsg: Message = {
        message_id: generateId(),
        role: 'assistant',
        content: assistantResponse.content,
        cards: assistantResponse.cards,
        actions: assistantResponse.actions,
        meta: assistantResponse.meta,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
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
      const companyName = companySettings?.['Naziv Podjetja'] || 'Podjetje';
      const chatInstructions = companySettings?.['chat_instructions'] || '';
      const chatTone = companySettings?.['chat_tone'] || 'prijazen in profesionalen';

      let contextData: Record<string, unknown> = {};
      const lowerMessage = userMessage.toLowerCase();

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

      const recentMessages = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

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

      const response = await fetch('https://tikej.app.n8n.cloud/webhook/asistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      return {
        content: extractMessageContent(result),
        cards: result.cards || null,
        actions: result.actions || null,
        meta: result.meta || { intent: result.intent },
      };
    } catch (error) {
      console.error('AI Response error:', error);
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
          actions: [{ type: 'quick_reply', label: 'Termini za jutri', value: 'termini_jutri' }],
          meta: { intent: 'appointments_today', count: appointments.length },
        };
      } else {
        return {
          content: 'Danes nimate nobenih terminov.',
          cards: null,
          actions: [{ type: 'quick_reply', label: 'Termini za jutri', value: 'termini_jutri' }],
          meta: { intent: 'appointments_today', count: 0 },
        };
      }
    }

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

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <CircleNotch className="w-8 h-8 text-violet-500" weight="bold" />
        </motion.div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Hidden SVG gradient definitions for icons */}
      <GradientDefs />

      <AnimatePresence mode="wait">
        {/* ── STATE 1: Initial centered minimal ── */}
        {!isExpanded && (
          <motion.div
            key="initial"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: -32,
              scale: 0.97,
              transition: { duration: 0.22, ease: 'easeIn' },
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:px-8"
          >
            {/* Title */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <h1
                  className="text-4xl font-bold tracking-tight"
                  style={{
                    background:
                      'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Asistent+
                </h1>
                <span
                  className="px-2 py-0.5 text-xs font-semibold rounded-full"
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8B5CF6',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                  }}
                >
                  BETA
                </span>
              </div>
              <p className="text-gray-500 text-lg">Kako vam lahko pomagam?</p>
            </motion.div>

            {/* Input */}
            <motion.div
              className="w-full max-w-2xl mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
            >
              <ChatInput
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onSend={() => sendMessage()}
                loading={loading}
                focused={inputFocused}
                textareaRef={textareaRef}
                pill
              />
            </motion.div>

            {/* Quick action chips */}
            <motion.div
              className="flex flex-wrap justify-center gap-3 max-w-2xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
            >
              {QUICK_ACTIONS.map((action, idx) => (
                <QuickActionChip
                  key={action.label}
                  label={action.label}
                  icon={action.icon}
                  delay={0.28 + idx * 0.05}
                  onClick={() => sendMessage(action.label)}
                />
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ── STATE 2: Expanded full chat ── */}
        {isExpanded && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Chat header */}
            <motion.header
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-shrink-0 h-14 flex items-center justify-between px-4 sm:px-6"
              style={{
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
              }}
            >
              {/* Brand */}
              <div className="flex items-center gap-2.5">
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{
                    background:
                      'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Asistent+
                </span>
                <span
                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8B5CF6',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                  }}
                >
                  BETA
                </span>
                {/* Online dot */}
                <div className="flex items-center gap-1.5 ml-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                    style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
                  />
                  <span className="text-xs text-gray-400">Online</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={onNewSession}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-3.5 py-1.5 text-sm font-medium rounded-full transition-all"
                  style={{
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    color: '#7C3AED',
                    background: 'rgba(139, 92, 246, 0.05)',
                  }}
                >
                  Nov pogovor
                </motion.button>
              </div>
            </motion.header>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
                <div className="space-y-6">
                  <AnimatePresence initial={false}>
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.message_id}
                        message={message}
                        onQuickAction={(action) => sendMessage(action.label)}
                        userInitials={userInitials}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {loading && (
                  <div className="mt-6">
                    <TypingIndicator />
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            {/* Bottom input area */}
            <div
              className="flex-shrink-0 px-4 sm:px-6 py-4"
              style={{
                background: 'rgba(255, 255, 255, 0.97)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(139, 92, 246, 0.08)',
              }}
            >
              <div className="max-w-3xl mx-auto">
                <ChatInput
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onSend={() => sendMessage()}
                  loading={loading}
                  focused={inputFocused}
                  textareaRef={textareaRef}
                />
                <p className="text-center text-[11px] text-gray-400 mt-2">
                  Asistent+ lahko dela napake. Preverite pomembne informacije.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
