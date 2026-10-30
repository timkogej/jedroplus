'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

type Summary = { enabled: boolean; visits: number; points: number; reward_threshold: number; reward_name: string };

export default function LoyaltyClientCard({ customerId }: { customerId: string }) {
  const english = useLocale() === 'en';
  const [loyalty, setLoyalty] = useState<Summary | null>(null);
  const [canRedeem, setCanRedeem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoyalty(null);
    setLoading(true);
    setMessage('');
    fetch(`/api/loyalty?customer_id=${encodeURIComponent(customerId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ loyalty: Summary; can_redeem: boolean }>;
      })
      .then((data) => { if (active) { setLoyalty(data.loyalty); setCanRedeem(data.can_redeem); } })
      .catch(() => { if (active) setMessage(english ? 'Could not load loyalty points.' : 'Točk ni bilo mogoče naložiti.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId, english]);

  const redeem = async () => {
    if (!loyalty || !window.confirm(english ? `Redeem ${loyalty.reward_name} for ${loyalty.reward_threshold} points?` : `Unovčim nagrado »${loyalty.reward_name}« za ${loyalty.reward_threshold} točk?`)) return;
    setRedeeming(true);
    setMessage('');
    try {
      const response = await fetch('/api/loyalty', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { loyalty: Summary };
      setLoyalty(data.loyalty);
      setMessage(english ? 'Reward redeemed.' : 'Nagrada je unovčena.');
    } catch {
      setMessage(english ? 'Could not redeem reward. Refresh the card and try again.' : 'Nagrade ni bilo mogoče unovčiti. Osvežite kartico in poskusite znova.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{english ? 'Loyalty card' : 'Kartica zvestobe'}</h3>
      {loading ? <p className="mt-3 text-sm text-gray-500">{english ? 'Loading...' : 'Nalagam...'}</p> : loyalty ? (
        <>
          <div className="mt-4 flex gap-8">
            <div><p className="text-2xl font-semibold text-gray-900">{loyalty.visits}</p><p className="text-xs text-gray-500">{english ? 'completed visits' : 'opravljenih obiskov'}</p></div>
            <div><p className="text-2xl font-semibold text-gray-900">{loyalty.points}</p><p className="text-xs text-gray-500">{english ? 'available points' : 'razpoložljivih točk'}</p></div>
          </div>
          {loyalty.enabled && <p className="mt-3 text-xs text-gray-500">{loyalty.reward_threshold} {english ? 'points for' : 'točk za'} {loyalty.reward_name}</p>}
          {loyalty.enabled && canRedeem && loyalty.points >= loyalty.reward_threshold && (
            <button type="button" disabled={redeeming} onClick={redeem} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {redeeming ? (english ? 'Redeeming...' : 'Unovčujem...') : (english ? 'Redeem reward' : 'Unovči nagrado')}
            </button>
          )}
        </>
      ) : null}
      {message && <p role="status" className="mt-3 text-sm text-gray-500">{message}</p>}
    </div>
  );
}
