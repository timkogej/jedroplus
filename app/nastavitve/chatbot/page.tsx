'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SpinnerGap, FloppyDisk, Copy, Check, Lock, CheckCircle } from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Input,
  Textarea,
  Select,
  SaveIndicator,
} from '@/components/settings';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';
import { supabaseReadOnly as supabase } from '@/src/lib/supabaseReadOnly';
import type { ChatbotDesign } from '@/types/settings';
import { defaultChatbotDesign } from '@/types/settings';

const CHATBOT_LANGUAGES = [
  { value: 'sl', label: 'Slovenščina' },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'de', label: 'Deutsch' },
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const sanitizeBorderRadius = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultChatbotDesign.borderRadius;
  return Math.min(30, Math.max(0, parsed));
};

// Fixed capabilities
const CAPABILITIES = [
  'Rezerviranje terminov',
  'Informacije o podjetju in storitvah',
  'Svetovanje glede na storitve',
  'Odgovarjanje na pogosta vprašanja',
];

export default function ChatbotSettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Basic settings
  const [language, setLanguage] = useState('sl');
  const [name, setName] = useState('');
  const [tone, setTone] = useState('');
  const [greeting, setGreeting] = useState('');
  const [instructions, setInstructions] = useState('');
  const [chatbotLink, setChatbotLink] = useState('');

  // Design settings
  const [design, setDesign] = useState<ChatbotDesign>(defaultChatbotDesign);

  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setIsLoading(true);

      try {
        // Fetch chatbot URL from companies table (CRITICAL - read from here)
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('chatbot_url')
          .eq('company_id', companyId)
          .single();

        if (companyError && companyError.code !== 'PGRST116') {
          console.error('Error fetching company chatbot_url:', companyError);
        }

        // Set chatbot link from companies table
        setChatbotLink(companyData?.chatbot_url || '');

        // Fetch other chatbot settings from Podatki podjetij
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          // Map from "Podatki podjetij" table columns
          setLanguage(String(data['chatbot jezik'] ?? data['chatbot_jezik'] ?? 'sl'));
          setName(String(data['chatbot_name'] ?? data['Chatbot_name'] ?? ''));
          setTone(String(data['Ton komunikacije chatbot'] ?? data['ton_komunikacije_chatbot'] ?? ''));
          setGreeting(String(data['chatbot_pozdrav'] ?? data['Chatbot_pozdrav'] ?? ''));
          setInstructions(String(data['Navodila chatbot'] ?? data['navodila_chatbot'] ?? ''));

          // Load design settings
          setDesign({
            bgGradientFrom: String(data['chat_bg_gradient_from'] ?? defaultChatbotDesign.bgGradientFrom),
            bgGradientTo: String(data['chat_bg_gradient_to'] ?? defaultChatbotDesign.bgGradientTo),
            userBubbleGradientFrom: String(data['chat_user_bubble_gradient_from'] ?? defaultChatbotDesign.userBubbleGradientFrom),
            userBubbleGradientTo: String(data['chat_user_bubble_gradient_to'] ?? defaultChatbotDesign.userBubbleGradientTo),
            userMsgGradientFrom: String(data['chat_user_msg_gradient_from'] ?? defaultChatbotDesign.userMsgGradientFrom),
            userMsgGradientTo: String(data['chat_user_msg_gradient_to'] ?? defaultChatbotDesign.userMsgGradientTo),
            botBubbleGradientFrom: String(data['chat_bot_bubble_gradient_from'] ?? defaultChatbotDesign.botBubbleGradientFrom),
            botBubbleGradientTo: String(data['chat_bot_bubble_gradient_to'] ?? defaultChatbotDesign.botBubbleGradientTo),
            accentGradientFrom: String(data['chat_accent_gradient_from'] ?? defaultChatbotDesign.accentGradientFrom),
            accentGradientTo: String(data['chat_accent_gradient_to'] ?? defaultChatbotDesign.accentGradientTo),
            textColor: String(data['chat_text_color'] ?? defaultChatbotDesign.textColor),
            fontFamily: String(data['chat_font_family'] ?? defaultChatbotDesign.fontFamily),
            borderRadius: sanitizeBorderRadius(data['chat_border_radius'] ?? defaultChatbotDesign.borderRadius),
          });
        }
      } catch (error) {
        console.error('Error loading chatbot settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);

    try {
      const borderRadius = sanitizeBorderRadius(design.borderRadius);
      const webhookPayload = {
        event: 'CHATBOT_SETTINGS_UPDATED',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          // Map to "Podatki podjetij" table columns
          'chatbot jezik': language,
          'Ton komunikacije chatbot': tone,
          'chatbot_pozdrav': greeting,
          'Navodila chatbot': instructions,
          'chat_bg_gradient_from': design.bgGradientFrom,
          'chat_bg_gradient_to': design.bgGradientTo,
          'chat_user_bubble_gradient_from': design.userBubbleGradientFrom,
          'chat_user_bubble_gradient_to': design.userBubbleGradientTo,
          'chat_user_msg_gradient_from': design.userMsgGradientFrom,
          'chat_user_msg_gradient_to': design.userMsgGradientTo,
          'chat_bot_bubble_gradient_from': design.botBubbleGradientFrom,
          'chat_bot_bubble_gradient_to': design.botBubbleGradientTo,
          'chat_accent_gradient_from': design.accentGradientFrom,
          'chat_accent_gradient_to': design.accentGradientTo,
          'chat_text_color': design.textColor,
          'chat_font_family': design.fontFamily,
          'chat_border_radius': borderRadius,
          // Normalized format
          chatbot_language: language,
          chatbot_name: name,
          chatbot_tone: tone,
          chatbot_greeting: greeting,
          chatbot_instructions: instructions,
          chatbot_design: { ...design, borderRadius },
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error('Napaka pri shranjevanju');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving chatbot settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateDesign = (key: keyof ChatbotDesign, value: string | number) => {
    setDesign(prev => ({
      ...prev,
      [key]: key === 'borderRadius' ? sanitizeBorderRadius(value) : value,
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const safeBorderRadius = sanitizeBorderRadius(design.borderRadius);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Chatbot+ nastavitve</h2>
          <p className="text-sm text-gray-500 mt-1">AI asistent za pomoč strankam</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Language Settings */}
        <SettingsSection title="Jezik" description="V katerem jeziku naj chatbot komunicira">
          <SettingRow
            label="Jezik za chatbot"
            description="Izberite jezik komunikacije"
          >
            <Select
              value={language}
              onChange={(value) => setLanguage(value)}
              options={CHATBOT_LANGUAGES}
            />
          </SettingRow>
        </SettingsSection>

        {/* Personality & Tone */}
        <SettingsSection title="Osebnost & Ton" description="Kako naj chatbot komunicira">
          <SettingRow
            label="Ime chatbota"
            description="Kako se bot predstavi strankam"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="npr. Ana, Asistent+..."
            />
          </SettingRow>

          <SettingRow
            label="Ton komunikacije"
            description="Opišite želeni ton komunikacije"
          >
            <Input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="npr. prijazen, profesionalen, sproščen..."
            />
          </SettingRow>

          <SettingRow
            label="Pozdravno sporočilo"
            description="Prvo sporočilo ki ga vidi stranka"
            fullWidth
          >
            <Textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Pozdravite stranke ob prvem stiku..."
              rows={3}
            />
          </SettingRow>

          <SettingRow
            label="Navodila za chatbota"
            description="Specifična navodila, pravila, omejitve"
            fullWidth
          >
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Tu navedite posebna pravila, smernice ali omejitve za delovanje chatbota..."
              rows={5}
            />
            <p className="text-sm text-gray-500 mt-2">
              Tu navedite posebna pravila, smernice ali omejitve za delovanje chatbota
            </p>
          </SettingRow>
        </SettingsSection>

        {/* Chatbot Link - LOCKED */}
        <SettingsSection title="Link chatbota" description="Povezava do vašega chatbota">
          <div className="p-4 bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border-2 border-violet-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Link chatbota</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={chatbotLink || 'Ni konfiguriranega linka'}
                  disabled
                  className="flex-1 bg-white cursor-not-allowed"
                />
                <div className="flex items-center gap-1 text-gray-400">
                  <Lock className="h-4 w-4" weight="bold" />
                </div>
              </div>
              {chatbotLink && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(chatbotLink)}
                  className="p-2 border-2 border-violet-200 rounded-lg bg-white hover:bg-violet-50 transition-colors"
                >
                  {copiedLink ? (
                    <Check className="w-5 h-5 text-green-500" weight="bold" />
                  ) : (
                    <Copy className="w-5 h-5 text-violet-500" />
                  )}
                </motion.button>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Ta povezava je zaklenjena in jo lahko samo kopirate
            </p>
          </div>
        </SettingsSection>

        {/* Fixed Capabilities */}
        <SettingsSection title="Zmožnosti chatbota" description="Kaj lahko chatbot počne">
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            {CAPABILITIES.map((capability, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" weight="fill" />
                <span className="text-sm text-gray-700">{capability}</span>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Design Configuration */}
        <SettingsSection title="Dizajn chatbota" description="Prilagodite videz chatbota">
          {/* Background Gradient */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">Barva ozadja chatbota (gradient)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Od</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.bgGradientFrom}
                    onChange={(e) => updateDesign('bgGradientFrom', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.bgGradientFrom}
                    onChange={(e) => updateDesign('bgGradientFrom', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Do</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.bgGradientTo}
                    onChange={(e) => updateDesign('bgGradientTo', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.bgGradientTo}
                    onChange={(e) => updateDesign('bgGradientTo', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Bubble Gradient */}
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-700">Barva mehurčka uporabnika (gradient)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Od</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.userBubbleGradientFrom}
                    onChange={(e) => updateDesign('userBubbleGradientFrom', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.userBubbleGradientFrom}
                    onChange={(e) => updateDesign('userBubbleGradientFrom', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Do</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.userBubbleGradientTo}
                    onChange={(e) => updateDesign('userBubbleGradientTo', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.userBubbleGradientTo}
                    onChange={(e) => updateDesign('userBubbleGradientTo', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Message Text Gradient */}
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-700">Barva besedila uporabnika (gradient)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Od</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.userMsgGradientFrom}
                    onChange={(e) => updateDesign('userMsgGradientFrom', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.userMsgGradientFrom}
                    onChange={(e) => updateDesign('userMsgGradientFrom', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Do</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.userMsgGradientTo}
                    onChange={(e) => updateDesign('userMsgGradientTo', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.userMsgGradientTo}
                    onChange={(e) => updateDesign('userMsgGradientTo', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bot Bubble Gradient */}
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-700">Barva mehurčka chatbota (gradient)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Od</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.botBubbleGradientFrom}
                    onChange={(e) => updateDesign('botBubbleGradientFrom', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.botBubbleGradientFrom}
                    onChange={(e) => updateDesign('botBubbleGradientFrom', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Do</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.botBubbleGradientTo}
                    onChange={(e) => updateDesign('botBubbleGradientTo', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.botBubbleGradientTo}
                    onChange={(e) => updateDesign('botBubbleGradientTo', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Accent Gradient */}
          <div className="space-y-4 mt-6">
            <p className="text-sm font-medium text-gray-700">Barva poudarka (gradient)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Od</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.accentGradientFrom}
                    onChange={(e) => updateDesign('accentGradientFrom', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.accentGradientFrom}
                    onChange={(e) => updateDesign('accentGradientFrom', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Do</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={design.accentGradientTo}
                    onChange={(e) => updateDesign('accentGradientTo', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                  />
                  <Input
                    value={design.accentGradientTo}
                    onChange={(e) => updateDesign('accentGradientTo', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Text Color */}
          <SettingRow
            label="Barva besedila"
            description="Barva besedila v chatbotu"
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={design.textColor}
                onChange={(e) => updateDesign('textColor', e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
              />
              <Input
                value={design.textColor}
                onChange={(e) => updateDesign('textColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </SettingRow>

          {/* Font Family */}
          <SettingRow
            label="Pisava"
            description="Tip pisave v chatbotu"
          >
            <Select
              value={design.fontFamily}
              onChange={(value) => updateDesign('fontFamily', value)}
              options={FONT_OPTIONS}
            />
          </SettingRow>

          {/* Border Radius */}
          <SettingRow
            label={`Zaobljenost robov (${safeBorderRadius}px)`}
            description="Kako zaobljeni so robovi elementov"
            fullWidth
          >
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={safeBorderRadius}
              onChange={(e) => updateDesign('borderRadius', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </SettingRow>

        </SettingsSection>

        {/* Save Button */}
        <div className="flex justify-end pt-6">
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving}
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                       px-6 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/25
                       transition-shadow hover:shadow-xl hover:shadow-violet-500/30
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                Shranjujem...
              </>
            ) : (
              <>
                <FloppyDisk className="h-4 w-4" weight="bold" />
                Shrani spremembe
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
