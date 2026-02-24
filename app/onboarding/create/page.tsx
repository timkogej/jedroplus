'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCompany } from '@/lib/api/billingClient';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const STORAGE_KEY = "jedroplus_company_id";
const STORAGE_KEY_UUID = "jedroplus_company_uuid";

// Simple confetti implementation
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
    const confettiPieces: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rotation: number; rotationSpeed: number; opacity: number }[] = [];

    for (let i = 0; i < 150; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDone = true;

      for (const p of confettiPieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;

        if (p.y > canvas.height) {
          p.opacity -= 0.02;
        }

        if (p.opacity > 0) {
          allDone = false;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }

      if (!allDone) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}

export default function CreateCompanyPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCompanyPublicId, setCreatedCompanyPublicId] = useState('');

  const [showConfetti, setShowConfetti] = useState(false);

  const handleCreate = async () => {
    if (!companyName.trim()) {
      toast.error('Vnesite ime podjetja');
      return;
    }

    try {
      setLoading(true);

      const result = await createCompany(companyName);

      if (result.ok && result.company_id) {
        // result.company_id from n8n is the UUID
        const companyUUID = result.company_id;

        // Use company_slug from n8n response if available (avoids querying companies table)
        let publicId = (result as unknown as Record<string, unknown>).company_slug as string | undefined;

        if (!publicId) {
          // Fetch the company to get the 6-char public ID with retry logic
          // n8n might not have committed the data yet, so we retry a few times
          for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
              // Wait before retrying: 1s, 2s
              await new Promise(r => setTimeout(r, attempt * 1000));
            }

            try {
              const { data: company } = await supabase
                .from('companies')
                .select('id, company_id, name')
                .eq('id', companyUUID)
                .single();

              if (company?.company_id) {
                publicId = company.company_id;
                break;
              }
            } catch {
              // Retry on error
              console.warn(`[CreateCompany] Attempt ${attempt + 1} to fetch company failed, retrying...`);
            }
          }
        }

        if (publicId) {
          // Store the 6-char public ID (used for filtering business tables)
          localStorage.setItem(STORAGE_KEY, publicId);
          localStorage.setItem(STORAGE_KEY_UUID, companyUUID);
          document.cookie = `company_id=${publicId}; path=/; max-age=31536000`;

          // Update profile with company UUID (non-blocking, n8n likely already did this)
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              supabase
                .from('profiles')
                .update({ default_company_id: companyUUID })
                .eq('id', user.id)
                .then(({ error }) => {
                  if (error) console.warn('[CreateCompany] Profile update failed (n8n should have handled this):', error.message);
                });
            }
          });

          // Show success with the 6-char public ID and join code
          setCreatedCompanyPublicId(publicId);

          setShowConfetti(true);
          toast.success('Podjetje uspešno ustvarjeno!');
        } else {
          toast.error('Napaka pri nalaganju podjetja. Prosimo, poskusite znova.');
          setLoading(false);
        }
      } else {
        toast.error(result.error || 'Napaka pri ustvarjanju podjetja');
        setLoading(false);
      }
    } catch (error) {
      console.error('Create company error:', error);
      toast.error('Napaka pri ustvarjanju podjetja');
      setLoading(false);
    }
  };

  // Success view
  if (createdCompanyPublicId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        {showConfetti && <Confetti />}
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-10 text-center">
            {/* Success icon */}
            <div
              className="w-24 h-24 mx-auto mb-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #34D399 50%, #6EE7B7 100%)',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.25)',
              }}
            >
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Podjetje je ustvarjeno
            </h2>
            <p className="text-gray-500 mb-10">
              Vaše podjetje je pripravljeno za uporabo
            </p>

            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full h-12 text-white font-semibold rounded-xl transition-all duration-300 hover:opacity-90 hover:shadow-lg"
              style={{
                background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
              }}
            >
              Pojdi na Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create form view
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">Ustvari podjetje</h1>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Ime podjetja</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Jedro Plus d.o.o."
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !companyName.trim()}
            className="w-full h-12 text-white font-semibold rounded-xl transition-all duration-300 hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
            }}
          >
            {loading ? 'Ustvarjam...' : 'Ustvari'}
          </button>

          <button
            onClick={() => router.push('/onboarding')}
            disabled={loading}
            className="w-full h-12 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Nazaj
          </button>
        </div>
      </div>
    </div>
  );
}
