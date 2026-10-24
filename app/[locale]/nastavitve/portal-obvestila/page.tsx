'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

type Announcement = {
  id: string; title: string; body: string; audience: 'all' | 'customer';
  recipient_email: string | null; image_url: string | null; status: 'draft' | 'published' | 'archived';
  published_at: string | null; created_at: string; email_status: string;
  email_result: { requested?: number; sent?: number; skipped?: number } | null;
};
type Recipient = { email: string; name: string };

function emailStatusLabel(status: string, en: boolean): string {
  const labels: Record<string, [string, string]> = {
    sending: ['Pošiljanje', 'Sending'], sent: ['Poslano', 'Sent'],
    partial: ['Delno poslano', 'Partially sent'], failed: ['Ni uspelo', 'Failed'],
    uncertain: ['Izid ni potrjen', 'Outcome unconfirmed'],
  };
  return labels[status]?.[en ? 1 : 0] ?? status;
}

export default function PortalAnnouncementsPage() {
  const en = useLocale() === 'en';
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'customer'>('all');
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Recipient[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ id: string; eligible: number; total: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/portal-announcements', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json() as { announcements: Announcement[] };
      setItems(data.announcements);
      setMessage('');
    } catch {
      setMessage(en ? 'Could not load announcements.' : 'Obvestil ni bilo mogoče naložiti.');
    } finally { setLoading(false); }
  }, [en]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (audience !== 'customer' || recipientEmail || search.trim().length < 2) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/portal-announcements/recipients?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : { recipients: [] })
        .then((data: { recipients: Recipient[] }) => setSuggestions(data.recipients ?? []))
        .catch(() => {});
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [audience, search, recipientEmail]);

  const reset = () => {
    setEditingId(null); setTitle(''); setBody(''); setAudience('all'); setRecipientEmail(null);
    setSearch(''); setSuggestions([]); setFile(null); setExistingImage(null); setRemoveImage(false);
    setFileInputKey((value) => value + 1);
  };

  const edit = (item: Announcement) => {
    setEditingId(item.id); setTitle(item.title); setBody(item.body); setAudience(item.audience);
    setRecipientEmail(item.recipient_email); setSearch(item.recipient_email ?? '');
    setExistingImage(item.image_url); setRemoveImage(false); setFile(null); setMessage('');
    setFileInputKey((value) => value + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (publish: boolean) => {
    if (busy || !title.trim() || !body.trim() || (audience === 'customer' && !recipientEmail)) return;
    if (publish && audience === 'all' && !window.confirm(en ? 'Publish this announcement for every customer in the portal?' : 'Objavim to obvestilo za vse stranke v portalu?')) return;
    setBusy(true); setMessage('');
    const form = new FormData();
    form.set('title', title.trim()); form.set('body', body.trim()); form.set('audience', audience);
    form.set('recipient_email', recipientEmail ?? ''); form.set('publish', String(publish));
    if (editingId) form.set('id', editingId);
    if (file) form.set('image', file);
    if (removeImage) form.set('remove_image', 'true');
    try {
      const response = await fetch('/api/portal-announcements', { method: editingId ? 'PUT' : 'POST', body: form });
      if (!response.ok) throw new Error();
      reset(); await load();
      setMessage(publish ? (en ? 'Published in the customer portal.' : 'Objavljeno v portalu strank.') : (en ? 'Draft saved.' : 'Osnutek je shranjen.'));
    } catch {
      setMessage(en ? 'Could not save announcement. Check the recipient and image.' : 'Obvestila ni bilo mogoče shraniti. Preverite prejemnika in sliko.');
    } finally { setBusy(false); }
  };

  const changeStatus = async (item: Announcement, action: 'publish' | 'archive' | 'delete') => {
    if (busy) return;
    const prompt = action === 'publish' ? (item.audience === 'all'
      ? (en ? 'Publish this announcement for every customer?' : 'Objavim to obvestilo za vse stranke?')
      : (en ? 'Publish this announcement?' : 'Objavim to obvestilo?'))
      : action === 'archive' ? (en ? 'Remove this announcement from the portal?' : 'Umaknem to obvestilo iz portala?')
      : (en ? 'Delete this draft?' : 'Izbrišem ta osnutek?');
    if (!window.confirm(prompt)) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(action === 'delete' ? `/api/portal-announcements?id=${item.id}` : '/api/portal-announcements', {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        ...(action !== 'delete' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, action }) } : {}),
      });
      if (!response.ok) throw new Error();
      if (editingId === item.id) reset();
      await load();
      setMessage(action === 'publish' ? (en ? 'Published.' : 'Objavljeno.') : action === 'archive' ? (en ? 'Removed from portal.' : 'Umaknjeno iz portala.') : (en ? 'Draft deleted.' : 'Osnutek je izbrisan.'));
    } catch { setMessage(en ? 'Action failed.' : 'Dejanja ni bilo mogoče izvesti.'); }
    finally { setBusy(false); }
  };

  const checkEmail = async (id: string) => {
    setBusy(true); setEmailPreview(null); setMessage('');
    try {
      const response = await fetch(`/api/portal-announcements/email?id=${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json() as { eligible: number; total: number };
      setEmailPreview({ id, eligible: data.eligible, total: data.total });
    } catch { setMessage(en ? 'Could not check email recipients.' : 'Prejemnikov e-pošte ni bilo mogoče preveriti.'); }
    finally { setBusy(false); }
  };

  const sendEmail = async () => {
    if (!emailPreview || busy || emailPreview.eligible === 0) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/portal-announcements/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emailPreview.id, confirm: true, expected_count: emailPreview.eligible }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        if (failure?.error === 'Recipient count changed; review again') throw new Error('recipients_changed');
        throw new Error();
      }
      const data = await response.json() as { email_status: string; totals: { sent: number; requested: number } };
      setEmailPreview(null); await load();
      setMessage(data.email_status === 'sent'
        ? (en ? `Email sent to ${data.totals.sent} customers.` : `E-pošta je poslana ${data.totals.sent} strankam.`)
        : (en ? `Email outcome: ${emailStatusLabel(data.email_status, true)}. Check the sent-message history.` : `Izid pošiljanja: ${emailStatusLabel(data.email_status, false)}. Preverite zgodovino poslanih sporočil.`));
    } catch (error) {
      setEmailPreview(null); await load();
      setMessage(error instanceof Error && error.message === 'recipients_changed'
        ? (en ? 'Recipient count changed. Check the recipients again before sending.' : 'Število prejemnikov se je spremenilo. Pred pošiljanjem jih preverite znova.')
        : (en ? 'Email sending could not be confirmed. Check the sent-message history before trying anything else.' : 'Pošiljanja e-pošte ni bilo mogoče potrditi. Pred nadaljnjim ukrepanjem preverite zgodovino sporočil.'));
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Link href="/nastavitve" className="text-sm text-gray-500 hover:text-gray-900">← {en ? 'Settings' : 'Nastavitve'}</Link>
      <h1 className="mt-5 text-2xl font-semibold text-gray-900">{en ? 'Customer portal announcements' : 'Obvestila za stranke'}</h1>
      <p className="mt-1 text-sm text-gray-500">{en ? 'Publish a post in the customer portal. An optional email alert can be sent separately after publishing.' : 'Objavite obvestilo v portalu. E-poštno opozorilo lahko po objavi pošljete posebej.'}</p>

      <section className="mt-7 space-y-5 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? (en ? 'Edit draft' : 'Uredi osnutek') : (en ? 'New announcement' : 'Novo obvestilo')}</h2>
          {editingId && <button type="button" onClick={reset} className="text-sm text-gray-500 underline">{en ? 'Cancel editing' : 'Prekliči urejanje'}</button>}
        </div>
        <div>
          <label htmlFor="announcement-audience" className="block text-sm font-medium text-gray-800">{en ? 'Recipients' : 'Prejemniki'}</label>
          <select id="announcement-audience" value={audience} onChange={(event) => { setAudience(event.target.value as 'all' | 'customer'); setRecipientEmail(null); setSearch(''); }} className="mt-2 w-full rounded-lg border border-gray-200 p-2.5 text-sm">
            <option value="all">{en ? 'All customers' : 'Vse stranke'}</option>
            <option value="customer">{en ? 'One customer' : 'Posamezna stranka'}</option>
          </select>
        </div>
        {audience === 'customer' && <div className="relative">
          <label htmlFor="announcement-recipient" className="block text-sm font-medium text-gray-800">{en ? 'Find customer by name or email' : 'Poiščite stranko po imenu ali e-pošti'}</label>
          <input id="announcement-recipient" value={search} onChange={(event) => { setSearch(event.target.value); setRecipientEmail(null); }} className="mt-2 w-full rounded-lg border border-gray-200 p-2.5 text-sm" />
          {recipientEmail && <p className="mt-1 text-xs text-emerald-700">{en ? 'Selected' : 'Izbrana'}: {recipientEmail}</p>}
          {suggestions.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((recipient) => <button type="button" key={recipient.email} onClick={() => { setRecipientEmail(recipient.email); setSearch(`${recipient.name} · ${recipient.email}`); setSuggestions([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
              <span className="font-medium">{recipient.name || recipient.email}</span><span className="ml-2 text-gray-500">{recipient.email}</span>
            </button>)}
          </div>}
        </div>}
        <div><label htmlFor="announcement-title" className="block text-sm font-medium text-gray-800">{en ? 'Title' : 'Naslov'}</label><input id="announcement-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 p-2.5 text-sm" /></div>
        <div><label htmlFor="announcement-body" className="block text-sm font-medium text-gray-800">{en ? 'Message' : 'Besedilo'}</label><textarea id="announcement-body" rows={6} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 p-2.5 text-sm" /><p className="mt-1 text-right text-xs text-gray-400">{body.length}/5000</p></div>
        <div><label htmlFor="announcement-image" className="block text-sm font-medium text-gray-800">{en ? 'Image (optional)' : 'Slika (neobvezno)'}</label><input key={fileInputKey} id="announcement-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveImage(false); }} className="mt-2 block w-full text-sm text-gray-600" /><p className="mt-1 text-xs text-gray-500">PNG, JPG ali WEBP · {en ? 'up to 3 MB' : 'do 3 MB'}</p>
          {(preview || (existingImage && !removeImage)) && <div className="mt-3"><img src={preview ?? existingImage ?? ''} alt={en ? 'Image preview' : 'Predogled slike'} className="max-h-52 w-full rounded-xl object-cover" />{existingImage && !file && <button type="button" onClick={() => setRemoveImage(true)} className="mt-1 text-xs text-red-600 underline">{en ? 'Remove image' : 'Odstrani sliko'}</button>}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !title.trim() || !body.trim() || (audience === 'customer' && !recipientEmail)} onClick={() => void save(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 disabled:opacity-50">{en ? 'Save draft' : 'Shrani osnutek'}</button>
          <button type="button" disabled={busy || !title.trim() || !body.trim() || (audience === 'customer' && !recipientEmail)} onClick={() => void save(true)} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{en ? 'Publish in portal' : 'Objavi v portalu'}</button>
        </div>
      </section>

      {message && <p role="status" className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">{message}</p>}
      <section className="mt-9">
        <h2 className="text-lg font-semibold text-gray-900">{en ? 'Announcements' : 'Obvestila'}</h2>
        {loading ? <p className="mt-3 text-sm text-gray-500">{en ? 'Loading...' : 'Nalagam...'}</p> : items.length === 0 ? <p className="mt-3 text-sm text-gray-500">{en ? 'No announcements yet.' : 'Obvestil še ni.'}</p> : (
          <div className="mt-4 space-y-3">
            {items.map((item) => <article key={item.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-gray-900">{item.title}</h3><p className="mt-1 text-xs text-gray-500">{item.audience === 'all' ? (en ? 'All customers' : 'Vse stranke') : item.recipient_email} · {item.status === 'published' ? (en ? 'Published' : 'Objavljeno') : item.status === 'draft' ? (en ? 'Draft' : 'Osnutek') : (en ? 'Archived' : 'Umaknjeno')}</p></div>{item.published_at && <time className="shrink-0 text-xs text-gray-400">{new Date(item.published_at).toLocaleDateString(en ? 'en-GB' : 'sl-SI')}</time>}</div>
              <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-gray-600">{item.body}</p>
              {item.image_url && <img src={item.image_url} alt="" className="mt-3 max-h-36 w-full rounded-lg object-cover" />}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium">
                {item.status === 'draft' && <><button type="button" disabled={busy} onClick={() => edit(item)} className="text-gray-700 underline">{en ? 'Edit' : 'Uredi'}</button><button type="button" disabled={busy} onClick={() => void changeStatus(item, 'publish')} className="text-gray-700 underline">{en ? 'Publish' : 'Objavi'}</button><button type="button" disabled={busy} onClick={() => void changeStatus(item, 'delete')} className="text-red-600 underline">{en ? 'Delete' : 'Izbriši'}</button></>}
                {item.status === 'published' && <><button type="button" disabled={busy} onClick={() => void changeStatus(item, 'archive')} className="text-gray-700 underline">{en ? 'Remove from portal' : 'Umakni iz portala'}</button>{item.email_status === 'not_requested' ? <button type="button" disabled={busy} onClick={() => void checkEmail(item.id)} className="text-gray-700 underline">{en ? 'Email alert...' : 'E-poštno opozorilo...'}</button> : <span className="text-gray-500">{en ? 'Email' : 'E-pošta'}: {emailStatusLabel(item.email_status, en)}{item.email_result?.sent !== undefined ? ` (${item.email_result.sent}/${item.email_result.requested})` : ''}</span>}</>}
              </div>
              {emailPreview?.id === item.id && <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700"><p>{en ? `${emailPreview.eligible} of ${emailPreview.total} contacts are eligible for email.` : `${emailPreview.eligible} od ${emailPreview.total} zapisov je upravičenih do e-pošte.`}</p><p className="mt-1 text-xs text-gray-500">{en ? 'Only customers with marketing consent who have not opted out. Email contains the title and a link to sign in to the portal.' : 'Samo stranke s privolitvijo za tržna sporočila, ki se niso odjavile. E-pošta vsebuje naslov in povezavo za prijavo v portal.'}</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy || emailPreview.eligible === 0} onClick={() => void sendEmail()} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{en ? `Send email to ${emailPreview.eligible}` : `Pošlji e-pošto ${emailPreview.eligible} strankam`}</button><button type="button" onClick={() => setEmailPreview(null)} className="text-xs text-gray-600 underline">{en ? 'Cancel' : 'Prekliči'}</button></div></div>}
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}
