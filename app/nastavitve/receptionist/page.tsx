'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SpinnerGap, FloppyDisk, Copy, Check, Lock, Plus, Trash, Phone } from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Input,
  Textarea,
  SaveIndicator,
} from '@/components/settings';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { callN8nAction } from '@/src/lib/n8nClient';
import { supabaseReadOnly as supabase } from '@/src/lib/supabaseReadOnly';

interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  created_at?: string;
}

export default function ReceptionistSettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Receptionist settings
  const [phoneNumber, setPhoneNumber] = useState('');
  const [greetingText, setGreetingText] = useState('');
  const [handoffNumber, setHandoffNumber] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeChunk[]>([]);

  // Add knowledge modal
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  const actor = user?.email ?? 'unknown';

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
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
        // Load phone number from companies table (CRITICAL - read from here)
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('twillio_phone_number')
          .eq('company_id', companyId)
          .single();

        if (companyError && companyError.code !== 'PGRST116') {
          console.error('Error fetching company twillio_phone_number:', companyError);
        }

        // Set phone number from companies table
        setPhoneNumber(companyData?.twillio_phone_number || '');

        // Load settings from receptionist_settings table
        const { data: settingsData } = await supabase
          .from('receptionist_settings')
          .select('greeting_text, default_handoff_number_e164')
          .eq('company_ref', companyId)
          .single();

        if (settingsData) {
          setGreetingText(settingsData.greeting_text || '');
          setHandoffNumber(settingsData.default_handoff_number_e164 || '');
        }

        // Load knowledge base from receptionist_knowledge_chunks table
        const { data: knowledgeData } = await supabase
          .from('receptionist_knowledge_chunks')
          .select('id, title, content, created_at')
          .eq('company_ref', companyId)
          .order('created_at', { ascending: false });

        if (knowledgeData) {
          setKnowledgeBase(knowledgeData);
        }
      } catch (error) {
        console.error('Error loading receptionist settings:', error);
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
      const webhookPayload = {
        event: 'RECEPTIONIST_SETTINGS_UPDATED',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          greeting_text: greetingText,
          default_handoff_number_e164: handoffNumber,
          // Normalized format
          receptionist_settings: {
            greeting: greetingText,
            handoff_number: handoffNumber,
          },
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error('Napaka pri shranjevanju');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving receptionist settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const addKnowledge = async () => {
    if (!companyId || !newTitle.trim() || !newContent.trim()) return;
    setSavingKnowledge(true);

    try {
      const webhookPayload = {
        event: 'RECEPTIONIST_KNOWLEDGE_ADDED',
        entity: 'knowledge',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          title: newTitle,
          content: newContent,
        },
      };

      await callN8nAction(webhookPayload);

      // Add to local state
      const newChunk: KnowledgeChunk = {
        id: Date.now().toString(),
        title: newTitle,
        content: newContent,
        created_at: new Date().toISOString(),
      };
      setKnowledgeBase(prev => [newChunk, ...prev]);

      // Reset form
      setNewTitle('');
      setNewContent('');
      setShowAddKnowledge(false);
    } catch (error) {
      console.error('Error adding knowledge:', error);
    } finally {
      setSavingKnowledge(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    if (!companyId) return;

    try {
      const webhookPayload = {
        event: 'RECEPTIONIST_KNOWLEDGE_DELETED',
        entity: 'knowledge',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          knowledge_id: id,
        },
      };

      await callN8nAction(webhookPayload);

      // Remove from local state
      setKnowledgeBase(prev => prev.filter(chunk => chunk.id !== id));
    } catch (error) {
      console.error('Error deleting knowledge:', error);
    }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Receptionist+ nastavitve</h2>
          <p className="text-sm text-gray-500 mt-1">AI telefonski asistent za vaše podjetje</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Phone Number - LOCKED */}
        <SettingsSection title="Telefonska \u0161tevilka" description="Uradna telefonska \u0161tevilka AI recepcije">
          <div className="p-4 bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border-2 border-violet-200">
            <div className="flex items-center gap-3 mb-2">
              <Phone className="w-5 h-5 text-violet-600" weight="fill" />
              <p className="text-sm font-semibold text-gray-700">Telefonska \u0161tevilka Receptionist+</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={phoneNumber || 'Ni dodeljene \u0161tevilke'}
                  disabled
                  className="flex-1 bg-white cursor-not-allowed font-mono"
                />
                <div className="flex items-center gap-1 text-gray-400">
                  <Lock className="h-4 w-4" weight="bold" />
                </div>
              </div>
              {phoneNumber && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(phoneNumber)}
                  className="p-2 border-2 border-violet-200 rounded-lg bg-white hover:bg-violet-50 transition-colors"
                >
                  {copiedPhone ? (
                    <Check className="w-5 h-5 text-green-500" weight="bold" />
                  ) : (
                    <Copy className="w-5 h-5 text-violet-500" />
                  )}
                </motion.button>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              To je uradna telefonska \u0161tevilka va\u0161ega AI receptorja. Strankam jo lahko delite za samodejno rezervacijo terminov.
            </p>
          </div>
        </SettingsSection>

        {/* Greeting & Handoff */}
        <SettingsSection title="Nastavitve klica" description="Kako AI odgovarja na klice">
          <SettingRow
            label="Pozdravno besedilo"
            description="To besedilo bo AI receptionist izgovoril ob klicu stranke"
            fullWidth
          >
            <Textarea
              value={greetingText}
              onChange={(e) => setGreetingText(e.target.value)}
              placeholder="Pozdravljeni! Sem AI asistent podjetja..."
              rows={4}
            />
          </SettingRow>

          <SettingRow
            label="\u0160tevilka za preusmeritev klica"
            description="\u010Ce AI ne more pomagati ali stranka \u017Eeli govoriti z osebo, bo klic preusmerjen na to \u0161tevilko"
          >
            <Input
              type="tel"
              value={handoffNumber}
              onChange={(e) => setHandoffNumber(e.target.value)}
              placeholder="+386 40 123 456"
            />
          </SettingRow>
        </SettingsSection>

        {/* Knowledge Base */}
        <SettingsSection title="Baza znanja" description="Podatki o podjetju, storitvah, cenah in drugih informacijah">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Dodajte podatke o podjetju, storitvah, cenah, delovnem \u010Dasu in drugih pomembnih informacijah
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddKnowledge(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" weight="bold" />
                Dodaj znanje
              </motion.button>
            </div>

            {/* Knowledge items list */}
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {knowledgeBase.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-gray-500"
                  >
                    <p>Ni dodanega znanja. Dodajte prvo vnos!</p>
                  </motion.div>
                ) : (
                  knowledgeBase.map((chunk) => (
                    <motion.div
                      key={chunk.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-gray-900">{chunk.title}</h4>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {chunk.content}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteKnowledge(chunk.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash className="w-4 h-4" weight="bold" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </SettingsSection>

        {/* Add Knowledge Modal */}
        <AnimatePresence>
          {showAddKnowledge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowAddKnowledge(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
              >
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Dodaj novo znanje</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Dodajte informacije ki jih bo AI receptionist uporabil pri klicih
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Naslov</label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="npr. Delovni \u010Das, Storitve, Cenik..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vsebina</label>
                    <Textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      rows={8}
                      placeholder="Vnesite podrobne informacije..."
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddKnowledge(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Prekli\u010Di
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={addKnowledge}
                    disabled={savingKnowledge || !newTitle.trim() || !newContent.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-cyan-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {savingKnowledge ? (
                      <>
                        <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                        Shranjujem...
                      </>
                    ) : (
                      'Shrani'
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
