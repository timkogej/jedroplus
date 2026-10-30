'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ArrowCounterClockwise, Crop, ImageSquare, Trash, UploadSimple } from '@phosphor-icons/react';
import ImageCropper, { INITIAL_CROP, type CropState } from './ImageCropper';
import { MIN_SOURCE_SIDE, loadImage, type ImageShape } from './imageProcessing';

/** What should happen to the photo when the form is saved. */
export type ImageChange =
  | { type: 'keep' }
  | { type: 'set'; blob: Blob; previewUrl: string }
  | { type: 'remove' };

export const KEEP_IMAGE: ImageChange = { type: 'keep' };

interface ImageFieldProps {
  shape: ImageShape;
  label: string;
  hint: string;
  /** Photo saved now, if any. */
  currentUrl: string | null | undefined;
  value: ImageChange;
  onChange: (change: ImageChange) => void;
  /** Shown when there is no photo (initials, colour tile). */
  fallback: ReactNode;
  disabled?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*';

/**
 * Photo picker for a form. The photo is cropped in the browser and kept here
 * until the form is saved; the page uploads it then (lib/media/entityImage).
 */
export default function ImageField({
  shape,
  label,
  hint,
  currentUrl,
  value,
  onChange,
  fallback,
  disabled = false,
}: ImageFieldProps) {
  const t = useTranslations('common.media');
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{ img: HTMLImageElement; url: string } | null>(null);
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  // Free object URLs when they are replaced or the field goes away.
  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  const previewUrl = value.type === 'set' ? value.previewUrl : null;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // The form was reset (opened again): forget the picked original.
  useEffect(() => {
    if (value.type === 'keep') setSource(null);
  }, [value.type]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const loaded = await loadImage(file);
      if (Math.min(loaded.img.naturalWidth, loaded.img.naturalHeight) < MIN_SOURCE_SIDE) {
        URL.revokeObjectURL(loaded.url);
        setError(t('errors.tooSmall'));
        return;
      }
      setSource(loaded);
      setCrop(INITIAL_CROP);
      setCropping(true);
    } catch {
      setError(t('errors.unreadable'));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shown =
    value.type === 'set' ? value.previewUrl : value.type === 'remove' ? null : currentUrl || null;
  const hasPhoto = Boolean(shown);
  const round = shape === 'round';

  const frame = round
    ? 'h-[68px] w-[68px] rounded-full'
    : 'h-[84px] w-[112px] rounded-[12px]';

  return (
    <div
      className={`rounded-xl bg-white p-4 transition-shadow ${dropping ? 'ring-2 ring-[#7C78FA]/60' : ''}`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        if (!disabled) pick(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          aria-label={hasPhoto ? t('replace') : t('upload')}
          className={`group relative flex-shrink-0 overflow-hidden ${round ? '' : 'bg-gray-100'} ${frame} ${
            round ? '' : 'ring-1 ring-black/5'
          }`}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {shown ? (
              <motion.img
                key={shown}
                src={shown}
                alt=""
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <motion.div
                key="fallback"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {fallback}
              </motion.div>
            )}
          </AnimatePresence>
          {!disabled && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
              <UploadSimple className="h-5 w-5 text-white" weight="bold" />
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-1 text-[13px] leading-snug text-gray-500">{hint}</p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {(value.type !== 'keep' || error) && (
          <motion.div
            key={error ?? value.type}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className={`flex flex-wrap items-baseline gap-x-2 pt-3 text-[13px] ${error ? 'text-red-600' : 'text-gray-500'}`}>
              <span>{error ?? (value.type === 'set' ? t('pendingNew') : t('pendingRemove'))}</span>
              {!error && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(KEEP_IMAGE)}
                  className="inline-flex items-center gap-1 font-medium text-[#5B57E8] hover:underline disabled:opacity-50"
                >
                  <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />
                  {t('undo')}
                </button>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
        >
          {hasPhoto ? <ImageSquare className="h-4 w-4" /> : <UploadSimple className="h-4 w-4" />}
          {hasPhoto ? t('replace') : t('upload')}
        </button>

        {value.type === 'set' && source && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setCropping(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
          >
            <Crop className="h-4 w-4" />
            {t('adjust')}
          </button>
        )}

        {value.type === 'keep' && currentUrl && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ type: 'remove' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Trash className="h-4 w-4" />
            {t('remove')}
          </button>
        )}
      </div>

      <ImageCropper
        open={cropping}
        img={source?.img ?? null}
        shape={shape}
        initial={crop}
        onCancel={() => setCropping(false)}
        onApply={(blob, nextCrop) => {
          setCrop(nextCrop);
          setCropping(false);
          onChange({ type: 'set', blob, previewUrl: URL.createObjectURL(blob) });
        }}
      />
    </div>
  );
}
