'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatCircle, Trash, Plus, CircleNotch, Sparkle } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabaseClient';
import { useCompany } from '@/app/company-context';
import { format } from 'date-fns';
import { sl } from 'date-fns/locale';

interface Session {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface ConversationHistoryProps {
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function ConversationHistory({
  currentSessionId,
  onLoadSession,
  onNewSession,
}: ConversationHistoryProps) {
  const { companyId } = useCompany();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('Assistant_Sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading sessions:', error);
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Ali ste prepričani, da želite izbrisati to sejo?')) return;

    setDeletingId(sessionId);

    try {
      // Delete messages first (cascade should handle this, but being safe)
      await supabase.from('Assistant_Messages').delete().eq('session_id', sessionId);

      // Delete session
      await supabase.from('Assistant_Sessions').delete().eq('session_id', sessionId);

      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));

      if (sessionId === currentSessionId) {
        onNewSession();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="inline-block"
        >
          <CircleNotch className="w-6 h-6 text-violet-500" weight="bold" />
        </motion.div>
        <p className="text-xs text-gray-400 mt-2">Nalagam...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* New Session Button */}
      <motion.button
        onClick={onNewSession}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.99 }}
        className="w-full p-3 rounded-xl border border-dashed border-violet-300 bg-gradient-to-r from-violet-50 to-cyan-50 hover:from-violet-100 hover:to-cyan-100 transition-all flex items-center justify-center gap-2 text-violet-600 text-sm font-medium"
      >
        <Plus className="w-4 h-4" weight="bold" />
        Nova seja
      </motion.button>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="py-10 text-center">
          <ChatCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" weight="regular" />
          <p className="text-sm text-gray-400">Ni še pogovorov</p>
          <p className="text-xs text-gray-300 mt-1">Začnite nov pogovor</p>
        </div>
      ) : (
        <div className="space-y-1.5 mt-3">
          <AnimatePresence>
            {sessions.map((session, index) => {
              const isActive = session.session_id === currentSessionId;
              const isDeleting = deletingId === session.session_id;

              return (
                <motion.div
                  key={session.session_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => onLoadSession(session.session_id)}
                  className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/20'
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200'
                  } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Active Badge */}
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-white bg-white/20 rounded-md mb-1.5 backdrop-blur-sm"
                        >
                          <Sparkle className="w-2.5 h-2.5" weight="fill" />
                          AKTIVNO
                        </motion.div>
                      )}

                      {/* Title */}
                      <h4
                        className={`text-sm font-medium truncate ${
                          isActive ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {session.title}
                      </h4>

                      {/* Timestamp */}
                      <p
                        className={`text-[10px] mt-0.5 ${
                          isActive ? 'text-white/70' : 'text-gray-400'
                        }`}
                      >
                        {format(new Date(session.updated_at), "dd.MM.yyyy 'ob' HH:mm", {
                          locale: sl,
                        })}
                      </p>
                    </div>

                    {/* Delete Button */}
                    <motion.button
                      onClick={(e) => handleDelete(session.session_id, e)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                        isActive
                          ? 'hover:bg-white/20 text-white/80 hover:text-white'
                          : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                      }`}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <CircleNotch className="w-3.5 h-3.5 animate-spin" weight="bold" />
                      ) : (
                        <Trash className="w-3.5 h-3.5" weight="regular" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
