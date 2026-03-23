'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Copy,
  Check,
  ArrowSquareOut,
  Gear,
  Globe,
  ChatCircle,
  ChatText,
  Warning,
  Robot,
  User,
  PaperPlaneTilt,
  Palette,
  TextT,
  CornersIn,
  CircleNotch,
  ArrowRight,
  Code,
  BookOpen,
  Shield,
  X,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { supabaseReadOnly as supabase } from '@/src/lib/supabaseReadOnly';
import { loadCompanyRow } from '@/lib/settingsStore';
import { ChatbotSettingsModal } from '@/components/chatbot/ChatbotSettingsModal';
import { defaultChatbotDesign } from '@/types/settings';
import type { ChatbotDesign } from '@/types/settings';

interface ChatbotData {
  url: string;
  name: string;
  language: string;
  tone: string;
  greeting: string;
  instructions: string;
  design: ChatbotDesign;
}

interface MiniChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  sl: 'Slovenščina',
  en: 'English',
  it: 'Italiano',
  de: 'Deutsch',
};

const GRADIENT = 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';

function sanitizeBorderRadius(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultChatbotDesign.borderRadius;
  return Math.min(30, Math.max(0, parsed));
}

// ─── Color swatch strip ────────────────────────────────────────────────────────

function GradientSwatch({ from, to, label }: { from: string; to: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 flex items-center gap-1">
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: from,
            border: '1.5px solid rgba(0,0,0,0.08)',
          }}
          title={from}
        />
        <div style={{ width: 10, height: 2, background: '#D1D5DB', borderRadius: 1 }} />
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: to,
            border: '1.5px solid rgba(0,0,0,0.08)',
          }}
          title={to}
        />
      </div>
      <div
        style={{
          flex: 1,
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(90deg, ${from}, ${to})`,
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      />
      <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', minWidth: 52, textAlign: 'right' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Config section sub-components ────────────────────────────────────────────

function ConfigSection({
  icon,
  label,
  sublabel,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid rgba(139, 92, 246, 0.08)',
        borderRadius: 16,
        padding: '16px 20px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      className="hover:border-violet-200 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-gray-900">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-gray-900">{label}</div>
          {sublabel && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: 2,
              }}
            >
              {sublabel}
            </div>
          )}
          <div className="text-sm text-gray-700 mt-1.5 truncate">{value}</div>
        </div>
      </div>
    </div>
  );
}

function ConfigSectionLarge({
  icon,
  label,
  sublabel,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid rgba(139, 92, 246, 0.08)',
        borderRadius: 16,
        padding: '16px 20px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      className="hover:border-violet-200 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 text-gray-900">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-gray-900">{label}</div>
          {sublabel && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: 2,
              }}
            >
              {sublabel}
            </div>
          )}
          <div className="text-sm text-gray-600 mt-1.5 line-clamp-3">{value}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation ID helpers (localStorage, keyed per company) ─────────────────

function getConversationId(companyId: string): string | null {
  try {
    return localStorage.getItem(`chatbot_conversation_id_${companyId}`);
  } catch {
    return null;
  }
}

function setConversationId(companyId: string, conversationId: string): void {
  try {
    localStorage.setItem(`chatbot_conversation_id_${companyId}`, conversationId);
  } catch {
    // localStorage unavailable – continue without persistence
  }
}

function clearConversationId(companyId: string): void {
  try {
    localStorage.removeItem(`chatbot_conversation_id_${companyId}`);
  } catch {
    // ignore
  }
}

// ─── Mini Asistent+ Chat Widget ────────────────────────────────────────────────

const MINI_QUICK_ACTIONS = [
  'Kako dodam chatbota na WordPress?',
  'Kako na Wix / Squarespace?',
  'Kaj je embed koda?',
  'Kako preverim, da chatbot deluje?',
];

const WELCOME_MSG: MiniChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Tukaj sem, da vam pomagam z implementacijo Chatbot+ na vašo spletno stran. Kar vprašajte – z veseljem pomogam!',
};

function MiniAsistentChat({ companyId }: { companyId: string | null }) {
  const [messages, setMessages] = useState<MiniChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (!hasInteracted.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    if (!companyId) {
      console.error('[MiniAsistentChat] company_id is missing – cannot send message');
      return;
    }

    hasInteracted.current = true;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      // Route through local proxy to avoid CORS and include user auth.
      const existingConvId = getConversationId(companyId);
      let url = `/api/n8n/chatbot-plus-message?company_id=${encodeURIComponent(companyId)}`;
      if (existingConvId) url += `&conversation_id=${encodeURIComponent(existingConvId)}`;

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      if (!authToken) {
        throw new Error('Missing auth token');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      let content = 'Oprostite, prišlo je do napake. Prosim poskusite znova.';
      if (response.ok) {
        const result = await response.json();
        // Persist returned conversation_id for all subsequent messages
        if (result.conversation_id) setConversationId(companyId, result.conversation_id);
        content = result.message ?? result.content ?? result.text ?? content;
      }

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: content }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Oprostite, prišlo je do napake. Preverite internetno povezavo in poskusite znova.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    if (companyId) clearConversationId(companyId);
    setMessages([WELCOME_MSG]);
    setInput('');
    hasInteracted.current = false;
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #EDE9FE 0%, #DBEAFE 60%, #CFFAFE 100%)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(139,92,246,0.18), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header - transparent so gradient shows through */}
      <div
        style={{
          background: 'transparent',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3B0764' }}>Asistent+</div>
            <div style={{ fontSize: 12, color: '#6D28D9', opacity: 0.75 }}>Online</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Shield icon */}
          <button
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              opacity: 0.7,
            }}
            title="Nastavitve zasebnosti"
          >
            <Shield size={17} color="#3B0764" />
          </button>
          {/* X button – clears conversation and starts a new chat */}
          <button
            onClick={startNewChat}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
              opacity: 0.7,
            }}
            title="Nova pogovor"
          >
            <X size={17} color="#3B0764" />
          </button>
        </div>
      </div>

      {/* Messages - transparent so gradient shows through */}
      <div
        style={{
          height: 320,
          overflowY: 'auto',
          padding: '16px 20px',
          background: 'transparent',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(139,92,246,0.25) transparent',
        }}
      >
        <div className="space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.role === 'user' ? 12 : -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div style={{ maxWidth: '82%' }}>
                <div
                  style={
                    msg.role === 'user'
                      ? {
                          background: GRADIENT,
                          borderRadius: '16px',
                          borderBottomRightRadius: 5,
                          padding: '10px 14px',
                          fontSize: 14,
                          lineHeight: 1.5,
                          fontFamily: 'inherit',
                          color: '#ffffff',
                          WebkitTextFillColor: '#ffffff',
                          boxShadow: '0 2px 10px rgba(139,92,246,0.28)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.92)',
                          borderRadius: '16px',
                          borderBottomLeftRadius: 5,
                          padding: '10px 14px',
                          fontSize: 14,
                          lineHeight: 1.5,
                          fontFamily: 'inherit',
                          color: '#1f2937',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        }
                  }
                >
                  {msg.text}
                </div>
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  borderRadius: '16px',
                  borderBottomLeftRadius: 5,
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', opacity: 0.8 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Quick actions - only show when no user message yet */}
          {messages.length === 1 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-2 pt-1"
            >
              {MINI_QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => send(action)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'rgba(255,255,255,0.85)',
                    fontSize: 12,
                    fontWeight: 500,
                    backgroundImage: GRADIENT,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
                  }}
                >
                  {action}
                </button>
              ))}
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area - transparent so gradient shows through */}
      <div style={{ padding: '12px 16px', background: 'transparent' }}>
        {/* Gradient border wrapper */}
        <div
          style={{
            position: 'relative',
            borderRadius: 24,
            background: GRADIENT,
            padding: '2px',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Vprašajte o implementaciji chatbota..."
            style={{
              display: 'block',
              width: '100%',
              border: 'none',
              borderRadius: 22,
              background: 'rgba(255,255,255,0.97)',
              padding: '11px 52px 11px 18px',
              fontSize: 13,
              color: '#1f2937',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: input.trim() && !loading ? GRADIENT : 'rgba(0,0,0,0.1)',
              border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
              boxShadow: input.trim() && !loading ? '0 2px 8px rgba(139,92,246,0.35)' : 'none',
            }}
          >
            {loading ? (
              <CircleNotch size={16} color="white" weight="bold" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <PaperPlaneTilt size={16} color={input.trim() ? 'white' : 'rgba(255,255,255,0.5)'} weight="fill" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatbotPlusPage() {
  const { companyId, loading: companyLoading } = useCompany();
  const { role, permissions } = useRolePermissions();
  const canManageSettings = role !== 'staff' || (permissions?.can_manage_chatbot_plus_settings ?? true);

  const [chatbotData, setChatbotData] = useState<ChatbotData>({
    url: '',
    name: '',
    language: 'sl',
    tone: '',
    greeting: '',
    instructions: '',
    design: defaultChatbotDesign,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [chatbotLink, setChatbotLink] = useState('');

  // Scroll to top when page data finishes loading
  useEffect(() => {
    if (!loading && !companyLoading) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [loading, companyLoading]);

  useEffect(() => {
    if (!companyId) return;

    const fetchChatbotData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('chatbot_url')
          .eq('company_id', companyId)
          .single();

        if (companyError && companyError.code !== 'PGRST116') {
          console.error('Error fetching company data:', companyError);
        }

        const { data: d } = await loadCompanyRow(companyId);

        // chatbot_omogoci: 'true'/'yes' = enabled, 'false'/'no' = disabled
        const enabledVal = String(d?.['chatbot_omogoci'] ?? 'yes').toLowerCase().trim();
        setChatbotEnabled(enabledVal === 'true' || enabledVal === 'yes');

        // chatbot_link from Podatki podjetij
        setChatbotLink(String(d?.['chatbot_link'] ?? ''));

        setChatbotData({
          url: companyData?.chatbot_url || '',
          name: String(d?.['chatbot_name'] ?? d?.['Chatbot_name'] ?? ''),
          language: String(d?.['chatbot jezik'] ?? d?.['chatbot_jezik'] ?? 'sl'),
          tone: String(d?.['Ton komunikacije chatbot'] ?? d?.['ton_komunikacije_chatbot'] ?? ''),
          greeting: String(d?.['chatbot_pozdrav'] ?? d?.['Chatbot_pozdrav'] ?? ''),
          instructions: String(d?.['Navodila chatbot'] ?? d?.['navodila_chatbot'] ?? ''),
          design: {
            bgGradientFrom: String(d?.['chat_bg_gradient_from'] ?? defaultChatbotDesign.bgGradientFrom),
            bgGradientTo: String(d?.['chat_bg_gradient_to'] ?? defaultChatbotDesign.bgGradientTo),
            userBubbleGradientFrom: String(d?.['chat_user_bubble_gradient_from'] ?? defaultChatbotDesign.userBubbleGradientFrom),
            userBubbleGradientTo: String(d?.['chat_user_bubble_gradient_to'] ?? defaultChatbotDesign.userBubbleGradientTo),
            userMsgGradientFrom: String(d?.['chat_user_msg_gradient_from'] ?? defaultChatbotDesign.userMsgGradientFrom),
            userMsgGradientTo: String(d?.['chat_user_msg_gradient_to'] ?? defaultChatbotDesign.userMsgGradientTo),
            botBubbleGradientFrom: String(d?.['chat_bot_bubble_gradient_from'] ?? defaultChatbotDesign.botBubbleGradientFrom),
            botBubbleGradientTo: String(d?.['chat_bot_bubble_gradient_to'] ?? defaultChatbotDesign.botBubbleGradientTo),
            accentGradientFrom: String(d?.['chat_accent_gradient_from'] ?? defaultChatbotDesign.accentGradientFrom),
            accentGradientTo: String(d?.['chat_accent_gradient_to'] ?? defaultChatbotDesign.accentGradientTo),
            textColor: String(d?.['chat_text_color'] ?? defaultChatbotDesign.textColor),
            fontFamily: String(d?.['chat_font_family'] ?? defaultChatbotDesign.fontFamily),
            borderRadius: sanitizeBorderRadius(d?.['chat_border_radius'] ?? defaultChatbotDesign.borderRadius),
          },
        });
      } catch (err) {
        console.error('Error loading chatbot data:', err);
        setError('Napaka pri nalaganju podatkov');
      } finally {
        setLoading(false);
      }
    };

    fetchChatbotData();
  }, [companyId]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (companyLoading || loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAFBFF' }}>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2"
            style={{ borderColor: '#8B5CF6', borderTopColor: 'transparent' }}
          />
        </div>
      </ProtectedLayout>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAFBFF' }}>
          <div className="text-center">
            <Warning size={48} className="text-red-500 mx-auto mb-4" weight="regular" />
            <p className="text-gray-700 font-medium mb-2">Prišlo je do napake</p>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-white rounded-lg transition-colors"
              style={{ background: GRADIENT }}
            >
              Poskusi znova
            </button>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  const botName = chatbotData.name || 'Asistent';
  const botGreeting = chatbotData.greeting || 'Pozdravljeni! 👋 Kako vam lahko pomagam danes?';
  const { design } = chatbotData;
  const borderRadius = sanitizeBorderRadius(design.borderRadius);
  const accentGradient = `linear-gradient(135deg, ${design.accentGradientFrom}, ${design.accentGradientTo})`;
  const userMsgGradient = `linear-gradient(135deg, ${design.userMsgGradientFrom}, ${design.userMsgGradientTo})`;
  const botBubbleGradient = `linear-gradient(135deg, ${design.botBubbleGradientFrom}, ${design.botBubbleGradientTo})`;

  const effectiveChatbotUrl = chatbotLink || chatbotData.url;
  const embedCode = effectiveChatbotUrl
    ? `<script>\n  (function() {\n    var s = document.createElement('script');\n    s.src = '${effectiveChatbotUrl.replace(/\/$/, '')}/embed.js';\n    s.async = true;\n    document.body.appendChild(s);\n  })();\n</script>`
    : `<script>\n  (function() {\n    var s = document.createElement('script');\n    s.src = 'https://chatbot.jedro.si/embed.js';\n    s.async = true;\n    document.body.appendChild(s);\n  })();\n</script>`;

  return (
    <ProtectedLayout>
      {/* ── Mesh gradient background ───────────────────────────────────────────── */}
      <div
        className="min-h-screen"
        style={{
          background:
            'radial-gradient(at 20% 20%, rgba(139, 92, 246, 0.08) 0px, transparent 50%), ' +
            'radial-gradient(at 80% 10%, rgba(6, 182, 212, 0.06) 0px, transparent 50%), ' +
            'radial-gradient(at 40% 80%, rgba(59, 130, 246, 0.05) 0px, transparent 50%), ' +
            'linear-gradient(180deg, #FAFBFF 0%, #F0F4FF 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Page Header ─────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 flex items-start justify-between"
          >
            <div>
              <h1
                className="text-5xl font-bold"
                style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                Chatbot+
              </h1>
              <p className="mt-1 text-base text-gray-500">Vaš AI asistent za spletne strani</p>
            </div>
            {canManageSettings && (
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                title="Nastavitve"
              >
                <Gear size={20} weight="bold" className="text-gray-900" />
              </motion.button>
            )}
          </motion.div>

          {/* ── Two-column layout ────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-10 items-start">

            {/* ── LEFT: Embedded Chat Window Preview ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-full lg:w-auto flex-shrink-0 flex flex-col items-center"
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 420,
                  borderRadius: 24,
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${design.bgGradientFrom}, ${design.bgGradientTo})`,
                  boxShadow:
                    '0 32px 64px rgba(139, 92, 246, 0.15), ' +
                    '0 16px 32px rgba(0, 0, 0, 0.1), ' +
                    '0 0 0 1px rgba(139, 92, 246, 0.1)',
                  fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
                }}
              >
                {/* Chat Header - transparent, gradient shows through */}
                <div style={{ background: 'transparent', padding: '20px 24px' }}>
                  <div className="flex items-center gap-4">
                    {/* Bot avatar - square with shine (original shape), accent gradient bg */}
                    <div
                      style={{
                        width: 52, height: 52, borderRadius: 16,
                        background: accentGradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.2)',
                        flexShrink: 0, overflow: 'hidden', position: 'relative',
                      }}
                    >
                      <Robot size={28} color="white" weight="regular" />
                      <motion.div
                        animate={{ x: ['-150%', '250%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 16, fontWeight: 700, color: design.textColor, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                        {botName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div style={{ position: 'relative', width: 8, height: 8 }}>
                          <motion.div
                            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: '#34d399' }}
                          />
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #10b981)', position: 'relative' }} />
                        </div>
                        <span style={{ fontSize: 12, color: design.textColor, opacity: 0.7, fontWeight: 500 }}>Na voljo za klepet</span>
                      </div>
                    </div>
                    {/* Shield + X buttons - black icons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}>
                        <Shield size={16} color="#111827" weight="fill" />
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}>
                        <X size={16} color="#111827" weight="bold" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Area - transparent, gradient shows through */}
                <div style={{ background: 'transparent', padding: '24px', minHeight: 310 }}>
                  <div className="space-y-5">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, delay: 0.2 }} className="flex justify-start">
                      <div style={{ maxWidth: '85%' }}>
                        <div style={{ background: botBubbleGradient, borderRadius: '20px', borderBottomLeftRadius: 6, padding: '14px 18px', fontSize: 15, lineHeight: 1.55, color: design.textColor, fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>{botGreeting}</div>
                        <div style={{ fontSize: 11, color: design.textColor, opacity: 0.5, marginTop: 6, paddingLeft: 4 }}>17:03</div>
                      </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, delay: 0.4 }} className="flex justify-end">
                      <div style={{ maxWidth: '85%' }}>
                        <div style={{ background: userMsgGradient, borderRadius: '20px', borderBottomRightRadius: 6, padding: '14px 18px', fontSize: 15, lineHeight: 1.55, color: '#ffffff', fontFamily: 'inherit' }}>Rezerviraj termin</div>
                        <div style={{ fontSize: 11, color: design.textColor, opacity: 0.5, marginTop: 6, paddingRight: 4, textAlign: 'right' }}>17:03</div>
                      </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, delay: 0.6 }} className="flex justify-start">
                      <div style={{ maxWidth: '85%' }}>
                        <div style={{ background: botBubbleGradient, borderRadius: '20px', borderBottomLeftRadius: 6, padding: '14px 18px', fontSize: 15, lineHeight: 1.55, color: design.textColor, fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>Super, vesel me, da želiš rezervirati termin! 😊 Katero storitev bi želel naročiti?</div>
                        <div style={{ fontSize: 11, color: design.textColor, opacity: 0.5, marginTop: 6, paddingLeft: 4 }}>17:03</div>
                      </div>
                    </motion.div>
                  </div>
                  {/* Action chips: white bg, dark text, subtle border */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="flex flex-wrap gap-2 mt-5">
                    {['Rezerviraj termin', 'Kontaktni podatki', 'Delovni čas', 'Cenik storitev'].map((chip, idx) => (
                      <div key={idx} style={{ padding: '9px 16px', borderRadius: 18, border: '1.5px solid rgba(0,0,0,0.18)', background: 'transparent', fontSize: 13, fontWeight: 500, color: '#1f2937', cursor: 'default' }}>{chip}</div>
                    ))}
                  </motion.div>
                </div>

                {/* Input - transparent, accent gradient border wrapper */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} style={{ padding: '12px 20px 16px', background: 'transparent' }}>
                  <div style={{ position: 'relative', borderRadius: 28, background: accentGradient, padding: '2px' }}>
                    <div style={{ background: 'white', borderRadius: 26, padding: '12px 58px 12px 20px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: 15, color: '#a1a1aa', userSelect: 'none' }}>Napišite sporočilo...</span>
                    </div>
                    <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PaperPlaneTilt size={20} color="white" weight="fill" />
                    </div>
                  </div>
                </motion.div>

                {/* Footer - transparent */}
                <div style={{ padding: '6px 20px 12px', background: 'transparent', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.01em', color: design.textColor, opacity: 0.5 }}>Powered by Jedro+</span>
                </div>
              </div>

              <p className="text-center text-sm text-gray-400 mt-4 font-medium">Predogled chatbota</p>
            </motion.div>

            {/* ── RIGHT: Configuration Panel ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex-1 w-full min-w-0 space-y-4"
            >
              {/* Chatbot Status Card */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(20px)',
                  border: chatbotEnabled ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold text-gray-900">Status chatbota</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {chatbotEnabled ? 'Chatbot je aktiven na vaši spletni strani' : 'Chatbot trenutno ni aktiven'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div style={{ position: 'relative', width: 10, height: 10 }}>
                      {chatbotEnabled && (
                        <motion.div
                          animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: '#34d399' }}
                        />
                      )}
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: chatbotEnabled ? 'linear-gradient(135deg, #34d399, #10b981)' : '#E5E7EB',
                        position: 'relative',
                      }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: chatbotEnabled ? '#059669' : '#EF4444' }}>
                      {chatbotEnabled ? 'Omogočen' : 'Onemogočen'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nastavitve card */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(139,92,246,0.1)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-5">Nastavitve chatbota</h2>
                <div className="space-y-3">
                  <ConfigSection icon={<User size={20} weight="regular" />} label="Ime" sublabel="" value={chatbotData.name || '—'} />
                  <ConfigSection icon={<Globe size={20} weight="regular" />} label="Jezik" sublabel="" value={LANGUAGE_MAP[chatbotData.language] || chatbotData.language || '—'} />
                  <ConfigSectionLarge icon={<ChatText size={20} weight="regular" />} label="Navodila" sublabel="" value={chatbotData.instructions || 'Ni nastavljeno'} />
                  <ConfigSection icon={<ChatCircle size={20} weight="regular" />} label="Ton" sublabel="" value={chatbotData.tone || '—'} />
                </div>
                {canManageSettings && (
                  <motion.button
                    onClick={() => setShowSettingsModal(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mt-5 flex items-center justify-center gap-2 h-11 rounded-xl text-white font-medium text-sm"
                    style={{ background: GRADIENT, boxShadow: '0 4px 16px rgba(139,92,246,0.3)' }}
                  >
                    <Gear size={18} weight="bold" />
                    Uredi nastavitve chatbota
                  </motion.button>
                )}
              </div>

              {/* Dizajn chatbota card */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(139,92,246,0.1)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <Palette size={18} weight="regular" className="text-violet-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Dizajn chatbota</h2>
                </div>

                <div className="space-y-4">
                  {/* Background gradient */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Barva ozadja
                    </p>
                    <GradientSwatch from={design.bgGradientFrom} to={design.bgGradientTo} label="ozadje" />
                  </div>

                  {/* User bubble */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Mehurček uporabnika
                    </p>
                    <GradientSwatch from={design.userMsgGradientFrom} to={design.userMsgGradientTo} label="uporabnik" />
                  </div>

                  {/* Bot bubble */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Mehurček bota
                    </p>
                    <GradientSwatch from={design.botBubbleGradientFrom} to={design.botBubbleGradientTo} label="bot" />
                  </div>

                  {/* Accent */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Barva poudarka
                    </p>
                    <GradientSwatch from={design.accentGradientFrom} to={design.accentGradientTo} label="poudarek" />
                  </div>

                  <div style={{ height: 1, background: 'rgba(139,92,246,0.06)', margin: '4px 0' }} />

                  {/* Font */}
                  <div className="flex items-center gap-3">
                    <TextT size={16} weight="regular" className="text-violet-400 flex-shrink-0" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 80 }}>Pisava</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', fontFamily: 'system-ui, sans-serif' }}>System UI</span>
                  </div>

                  {/* Border radius */}
                  <div className="flex items-center gap-3">
                    <CornersIn size={16} weight="regular" className="text-violet-400 flex-shrink-0" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 80 }}>Zaobljenost</span>
                    <div className="flex items-center gap-2 flex-1">
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(borderRadius / 30) * 100}%`, background: GRADIENT, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1F2937', minWidth: 36, textAlign: 'right' }}>{borderRadius}px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Link chatbota card – always shown */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(139,92,246,0.1)',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Link chatbota</p>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-mono truncate flex-1 min-w-0 ${effectiveChatbotUrl ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                    {effectiveChatbotUrl || 'Link bo konfiguriran kmalu...'}
                  </p>
                  {effectiveChatbotUrl && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={async () => { await navigator.clipboard.writeText(effectiveChatbotUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:border-violet-300 transition-colors"
                      >
                        {copiedUrl ? <Check size={15} className="text-green-500" weight="bold" /> : <Copy size={15} className="text-gray-500" weight="regular" />}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => window.open(effectiveChatbotUrl, '_blank')}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:border-violet-300 transition-colors"
                      >
                        <ArrowSquareOut size={15} className="text-gray-500" weight="regular" />
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Implementation Instructions (full-width below) ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10"
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.1)',
                borderRadius: 20,
                padding: 32,
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <BookOpen size={22} color="#111827" weight="regular" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Navodila za implementacijo</h2>
                  <p className="text-sm text-gray-500">Kako dodate Chatbot+ na vašo spletno stran</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Steps */}
                <div className="space-y-5">
                  {[
                    {
                      step: 1,
                      title: 'Kopirajte embed kodo',
                      desc: 'Spodaj najdete kodo za vgraditev chatbota. Kliknite gumb "Kopiraj" za kopiranje v odložišče.',
                    },
                    {
                      step: 2,
                      title: 'Odprite HTML datoteko',
                      desc: 'V urejevalniku kode odprite glavno HTML datoteko vaše spletne strani (npr. index.html).',
                    },
                    {
                      step: 3,
                      title: 'Prilepite pred </body>',
                      desc: 'Poiščite zaključno oznako </body> na dnu datoteke in prilepite kodo tik pred njo.',
                    },
                    {
                      step: 4,
                      title: 'Shranite in preverite',
                      desc: 'Shranite datoteko in osvežite spletno stran. V spodnjem desnem kotu se bo pojavil gumb chatbota.',
                    },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-4">
                      <div
                        style={{
                          width: 28, height: 28,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 2,
                          fontSize: 16, fontWeight: 700,
                          background: GRADIENT,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}

                  {/* Platform tips */}
                  <div style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 14, padding: '14px 16px' }}>
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">Platforme</p>
                    <div className="space-y-1.5">
                      {[
                        { name: 'WordPress', tip: 'Pojdite v Videz → Uredi temo → theme.php ali dodajte vtičnik »Insert Headers and Footers«' },
                        { name: 'Wix / Squarespace', tip: 'Nastavitve → Koda → Dodaj kodo na nogo strani' },
                        { name: 'Shopify', tip: 'Teme → Uredi kodo → layout/theme.liquid → pred </body>' },
                        { name: 'Webflow', tip: 'Nastavitve projekta → Custom Code → Footer Code' },
                      ].map(({ name, tip }) => (
                        <div key={name} className="flex gap-2 text-sm">
                          <ArrowRight size={14} className="text-violet-400 flex-shrink-0 mt-0.5" weight="bold" />
                          <span><span className="font-semibold text-gray-800">{name}:</span> <span className="text-gray-500">{tip}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Embed code */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Code size={16} weight="regular" className="text-violet-500" />
                    <p className="text-sm font-semibold text-gray-700">Embed koda</p>
                  </div>
                  <div style={{ background: '#0F1117', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="flex gap-1.5">
                        {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>HTML</span>
                    </div>
                    <div className="overflow-x-auto" style={{ padding: '16px' }}>
                      <pre style={{ fontSize: 12, color: '#A5B4FC', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre', lineHeight: 1.7 }}>
                        {`<`}<span style={{ color: '#F97316' }}>script</span>{`>\n  (function() {\n    var `}<span style={{ color: '#86EFAC' }}>s</span>{` = document.`}<span style={{ color: '#67E8F9' }}>createElement</span>{`(`}<span style={{ color: '#FDE68A' }}>'script'</span>{`);\n    s.`}<span style={{ color: '#86EFAC' }}>src</span>{` = `}<span style={{ color: '#FDE68A' }}>{`'${effectiveChatbotUrl || 'https://chatbot.jedro.si'}/embed.js'`}</span>{`;\n    s.`}<span style={{ color: '#86EFAC' }}>async</span>{` = `}<span style={{ color: '#C4B5FD' }}>true</span>{`;\n    document.`}<span style={{ color: '#86EFAC' }}>body</span>{`.`}<span style={{ color: '#67E8F9' }}>appendChild</span>{`(s);\n  })();\n<`}<span style={{ color: '#F97316' }}>/script</span>{`>`}
                      </pre>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={async () => { await navigator.clipboard.writeText(embedCode); setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium border transition-all"
                    style={copiedEmbed
                      ? { background: '#F0FDF4', border: '1px solid #86EFAC', color: '#16A34A' }
                      : { background: 'white', border: '1px solid rgba(139,92,246,0.2)', color: '#7C3AED' }
                    }
                  >
                    {copiedEmbed ? <><Check size={16} weight="bold" /> Kopirano!</> : <><Copy size={16} weight="regular" /> Kopiraj embed kodo</>}
                  </motion.button>

                  {/* Important notes */}
                  <div className="mt-4 space-y-2">
                    {[
                      'Kodo dodajte samo enkrat na stran',
                      'Chatbot se bo prikazal na vseh podstraneh',
                      'Deluje na mobilnih napravah in namiznih računalnikih',
                    ].map((note, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                        <Check size={13} weight="bold" className="text-green-500 flex-shrink-0 mt-0.5" />
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Mini Asistent+ Chat Widget ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: GRADIENT }} />
              <h2 className="text-base font-semibold text-gray-700">Potrebujete pomoč?</h2>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', fontWeight: 600 }}>Asistent+</span>
            </div>
            <MiniAsistentChat companyId={companyId} />

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">
                Potrebujete dodatno pomoč?{' '}
                <a
                  href="mailto:help@jedroplus.com"
                  className="font-medium"
                  style={{ color: '#8B5CF6' }}
                >
                  help@jedroplus.com
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Settings Modal */}
      <ChatbotSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </ProtectedLayout>
  );
}
