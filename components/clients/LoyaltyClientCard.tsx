'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Summary = { enabled: boolean; visits: number; points: number; reward_threshold: number; reward_name: string };

export default function LoyaltyClientCard({ customerId }: { customerId: string }) {
  const t = useTranslations('clients.loyaltyCard');
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
      .catch(() => { if (active) setMessage(t('loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload per customer; t only labels the error
  }, [customerId]);

  const redeem = async () => {
    if (!loyalty || !window.confirm(t('confirm', { reward: loyalty.reward_name, threshold: loyalty.reward_threshold }))) return;
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
      setMessage(t('redeemed'));
    } catch {
      setMessage(t('redeemError'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('title')}</h3>
      {loading ? <p className="mt-3 text-sm text-gray-500">{t('loading')}</p> : loyalty ? (
        <>
          <div className="mt-4 flex gap-8">
            <div><p className="text-2xl font-semibold text-gray-900">{loyalty.visits}</p><p className="text-xs text-gray-500">{t('visits')}</p></div>
            <div><p className="text-2xl font-semibold text-gray-900">{loyalty.points}</p><p className="text-xs text-gray-500">{t('points')}</p></div>
          </div>
          {loyalty.enabled && <p className="mt-3 text-xs text-gray-500">{t('pointsFor', { threshold: loyalty.reward_threshold, reward: loyalty.reward_name })}</p>}
          {loyalty.enabled && canRedeem && loyalty.points >= loyalty.reward_threshold && (
            <button type="button" disabled={redeeming} onClick={redeem} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {redeeming ? t('redeeming') : t('redeem')}
            </button>
          )}
        </>
      ) : null}
      {message && <p role="status" className="mt-3 text-sm text-gray-500">{message}</p>}
    </div>
  );
}
