'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Copy,
  Check,
  ArrowSquareOut,
  Gear,
  Globe,
  ChatCircle,
  Sparkle,
  ChatText,
  SpinnerGap,
  Warning,
  Robot,
  ChatCenteredDots,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabaseReadOnly as supabase } from '@/src/lib/supabaseReadOnly';
import { loadCompanyRow } from '@/lib/settingsStore';
import { ChatbotSettingsModal } from '@/components/chatbot/ChatbotSettingsModal';
import { ChatbotPreview } from '@/components/chatbot/ChatbotPreview';

interface ChatbotDesign {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: React.ReactNode;
}

interface ChatbotData {
  url: string;
  name: string;
  language: string;
  tone: string;
  greeting: string;
  instructions: string;
}

const CAPABILITIES = [
  { title: 'Rezerviranje terminov', description: 'Rezervira termine namesto vas' },
  { title: 'Informacije o podjetju', description: 'Odgovarja na vprašanja o storitvah' },
  { title: 'Svetovanje strankam', description: 'Pomaga pri izbiri storitev' },
  { title: '24/7 dostopnost', description: 'Vedno na voljo strankam' },
];

const LANGUAGE_MAP: Record<string, string> = {
  sl: 'Slovenščina',
  en: 'English',
  it: 'Italiano',
  de: 'Deutsch',
};

// Chatbot designs
const CHATBOT_DESIGNS: ChatbotDesign[] = [
  {
    id: 'classic',
    name: 'Klasični',
    description: 'Standardni chatbot vmesnik',
    icon: <ChatCenteredDots className="w-6 h-6" weight="regular" />,
    preview: (
      <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex flex-col overflow-hidden border border-gray-200">
        <div className="h-8 bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center px-3">
          <div className="w-4 h-4 rounded-full bg-white/30" />
          <span className="ml-2 text-xs text-white font-medium">Chatbot</span>
        </div>
        <div className="flex-1 p-2 space-y-1">
          <div className="flex justify-start">
            <div className="w-16 h-4 bg-gray-200 rounded-lg" />
          </div>
          <div className="flex justify-end">
            <div className="w-20 h-4 bg-violet-200 rounded-lg" />
          </div>
          <div className="flex justify-start">
            <div className="w-24 h-4 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'modern',
    name: 'Moderni',
    description: 'Eleganten in sodoben dizajn',
    icon: <Robot className="w-6 h-6" weight="regular" />,
    preview: (
      <div className="w-full h-32 bg-gradient-to-br from-violet-50 to-cyan-50 rounded-lg flex flex-col overflow-hidden border border-violet-200">
        <div className="h-8 bg-white/80 backdrop-blur flex items-center justify-center px-3 border-b border-violet-100">
          <span className="text-xs font-semibold bg-gradient-to-r from-violet-600 to-cyan-600 bg-clip-text text-transparent">AI Asistent</span>
        </div>
        <div className="flex-1 p-2 space-y-1.5">
          <div className="flex justify-start gap-1">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400" />
            <div className="w-20 h-4 bg-white rounded-xl shadow-sm" />
          </div>
          <div className="flex justify-end">
            <div className="w-16 h-4 bg-gradient-to-r from-violet-400 to-cyan-400 rounded-xl" />
          </div>
          <div className="flex justify-start gap-1">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400" />
            <div className="w-24 h-4 bg-white rounded-xl shadow-sm" />
          </div>
        </div>
      </div>
    ),
  },
];

export default function ChatbotPlusPage() {
  const { companyId, loading: companyLoading } = useCompany();

  const [chatbotData, setChatbotData] = useState<ChatbotData>({
    url: '',
    name: '',
    language: 'sl',
    tone: '',
    greeting: '',
    instructions: '',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedDesignId, setCopiedDesignId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    const fetchChatbotData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch chatbot URL from companies table
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('chatbot_url')
          .eq('company_id', companyId)
          .single();

        if (companyError && companyError.code !== 'PGRST116') {
          console.error('Error fetching company data:', companyError);
        }

        // Fetch chatbot settings from Podatki podjetij
        const { data: settingsData } = await loadCompanyRow(companyId);

        setChatbotData({
          url: companyData?.chatbot_url || '',
          name: String(settingsData?.['chatbot_name'] ?? settingsData?.['Chatbot_name'] ?? ''),
          language: String(settingsData?.['chatbot jezik'] ?? settingsData?.['chatbot_jezik'] ?? 'sl'),
          tone: String(settingsData?.['Ton komunikacije chatbot'] ?? settingsData?.['ton_komunikacije_chatbot'] ?? ''),
          greeting: String(settingsData?.['chatbot_pozdrav'] ?? settingsData?.['Chatbot_pozdrav'] ?? ''),
          instructions: String(settingsData?.['Navodila chatbot'] ?? settingsData?.['navodila_chatbot'] ?? ''),
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

  const getDesignUrl = (designId: string): string => {
    if (!chatbotData.url) return '';
    // Add design parameter to URL
    const separator = chatbotData.url.includes('?') ? '&' : '?';
    return `${chatbotData.url}${separator}design=${designId}`;
  };

  const copyToClipboard = async (designId: string) => {
    const url = getDesignUrl(designId);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedDesignId(designId);
      setTimeout(() => setCopiedDesignId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Loading state - white background with simple black spinner
  if (companyLoading || loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </div>
      </ProtectedLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Warning size={48} className="text-red-500 mx-auto mb-4" weight="regular" />
            <p className="text-gray-700 font-medium mb-2">Prišlo je do napake</p>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
            >
              Poskusi znova
            </button>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header - Gradient title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold"
                  style={{
                    background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Chatbot+
                </h1>
                <p className="mt-1 text-gray-500">Vaš AI asistent za spletno stran</p>
              </div>

              {/* Icon only settings button */}
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                title="Nastavitve"
              >
                <span
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  <Gear size={20} weight="bold" />
                </span>
              </motion.button>
            </div>
          </motion.div>

          {/* Chatbot Designs Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Izberite dizajn chatbota</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CHATBOT_DESIGNS.map((design) => (
                <motion.div
                  key={design.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-violet-200 transition-all"
                >
                  {/* Preview */}
                  <div className="p-4 border-b border-gray-100">
                    {design.preview}
                  </div>

                  {/* Info & Actions */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-cyan-50 border border-violet-100 flex items-center justify-center text-violet-600">
                          {design.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{design.name}</h3>
                          <p className="text-sm text-gray-500">{design.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* URL Display */}
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Link chatbota</p>
                      <p className="text-sm font-mono text-gray-700 truncate">
                        {getDesignUrl(design.id) || 'Link ni na voljo'}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => copyToClipboard(design.id)}
                        disabled={!chatbotData.url}
                        className="flex-1 flex items-center justify-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {copiedDesignId === design.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-500" weight="bold" />
                            <span className="text-green-600">Kopirano!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" weight="regular" />
                            <span>Kopiraj link</span>
                          </>
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.open(getDesignUrl(design.id), '_blank')}
                        disabled={!chatbotData.url}
                        className="flex items-center justify-center gap-2 h-10 px-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ArrowSquareOut className="w-4 h-4" weight="regular" />
                        <span>Odpri</span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Configuration Cards Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
          >
            {/* Personality Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <ChatCircle className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Osebnost</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ime</div>
                  <div className="font-semibold text-gray-900">{chatbotData.name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ton</div>
                  <div className="font-semibold text-gray-900">{chatbotData.tone || '-'}</div>
                </div>
              </div>
            </div>

            {/* Language Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Jezik</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Aktivni jezik</div>
                  <div className="font-semibold text-gray-900">
                    {LANGUAGE_MAP[chatbotData.language] || chatbotData.language || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-4">
                <ChatText className="w-5 h-5 text-gray-900" weight="regular" />
                <h3 className="font-bold text-lg text-gray-900">Navodila</h3>
              </div>
              <p className="text-gray-600 text-sm line-clamp-4">
                {chatbotData.instructions || 'Ni nastavljeno'}
              </p>
            </div>
          </motion.div>

          {/* Greeting Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkle className="w-5 h-5 text-gray-900" weight="regular" />
              <h3 className="font-bold text-lg text-gray-900">Pozdravno sporočilo</h3>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">
              {chatbotData.greeting || 'Ni nastavljeno'}
            </p>
          </motion.div>

          {/* Chatbot Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Predogled chatbota</h2>
            <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-2xl border border-gray-200 p-8 flex items-center justify-center min-h-[500px] relative overflow-hidden">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />
              <div className="relative z-10">
                <ChatbotPreview
                  botName={chatbotData.name || 'Chatbot+'}
                  greeting={chatbotData.greeting}
                />
              </div>
            </div>
          </motion.div>

          {/* Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-violet-50 to-cyan-50 rounded-2xl border-2 border-violet-100 p-6 mb-8"
          >
            <h3 className="font-bold text-lg text-gray-900 mb-4">Zmožnosti</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAPABILITIES.map((capability, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" weight="bold" />
                  <div>
                    <div className="font-semibold text-gray-900">{capability.title}</div>
                    <div className="text-sm text-gray-600">{capability.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Implementation Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
          >
            <h3 className="font-bold text-lg text-gray-900 mb-4">Navodila za implementacijo</h3>
            <p className="text-gray-600 mb-4">
              Za dodajanje chatbota na vašo spletno stran, kopirajte spodnjo kodo in jo prilepite pred zaključni <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono">&lt;/body&gt;</code> značko vaše HTML datoteke.
            </p>

            <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all">
{`<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${chatbotData.url ? chatbotData.url.replace(/\/$/, '') + '/embed.js' : 'https://chatbot.jedro.si/embed.js'}';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>`}
              </pre>
            </div>

            <div className="mt-4 flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const embedCode = `<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${chatbotData.url ? chatbotData.url.replace(/\/$/, '') + '/embed.js' : 'https://chatbot.jedro.si/embed.js'}';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>`;
                  navigator.clipboard.writeText(embedCode);
                  setCopiedDesignId('embed');
                  setTimeout(() => setCopiedDesignId(null), 2000);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                {copiedDesignId === 'embed' ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" weight="bold" />
                    <span className="text-green-600">Kopirano!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" weight="regular" />
                    <span>Kopiraj kodo</span>
                  </>
                )}
              </motion.button>
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
