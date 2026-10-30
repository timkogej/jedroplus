// Saves a photo change from ImageField for a service or an employee, after the
// form itself has been saved. See app/api/media/entity-image.

import type { ImageChange } from '@/components/media/ImageField';

export type ImageKind = 'service' | 'staff';

/** Row id when known; `ref` ("ID storitve" / "ID osebe") right after creating. */
export type ImageTarget = { id: string } | { ref: string };

export type ImageSaveResult = { ok: true; url: string | null } | { ok: false; error: string };

export async function saveEntityImage(
  kind: ImageKind,
  target: ImageTarget,
  change: ImageChange
): Promise<ImageSaveResult | null> {
  if (change.type === 'keep') return null;

  try {
    if (change.type === 'remove') {
      const params = new URLSearchParams({ kind, ...target });
      const res = await fetch(`/api/media/entity-image?${params}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      return res.ok && data.ok ? { ok: true, url: null } : { ok: false, error: data.error ?? 'failed' };
    }

    const ext = change.blob.type === 'image/webp' ? 'webp' : change.blob.type === 'image/png' ? 'png' : 'jpg';
    const body = new FormData();
    body.append('kind', kind);
    if ('id' in target) body.append('id', target.id);
    else body.append('ref', target.ref);
    body.append('file', new File([change.blob], `photo.${ext}`, { type: change.blob.type }));

    const res = await fetch('/api/media/entity-image', { method: 'POST', body });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
    return res.ok && data.ok && data.url ? { ok: true, url: data.url } : { ok: false, error: data.error ?? 'failed' };
  } catch {
    return { ok: false, error: 'network' };
  }
}
