/**
 * Katalog rezervacijskih strani.
 *
 * Slogi v `squareStyle`, `titleStyle` in sorodnih opisujejo videz same
 * rezervacijske strani, ki jo vidi stranka — zato se ne ravnajo po dizajnu
 * aplikacije in jih prenova vmesnika ne spreminja.
 */

import type { CSSProperties } from 'react';
import type { ReservationSettings } from './reservationSettings';

export interface BookingDesign {
  id: number;
  designKey: string;
  linkKey: keyof ReservationSettings;
  accent: string;
  squareStyle: CSSProperties;
  badgeStyle: CSSProperties;
  titleStyle: CSSProperties;
  subtitleStyle: CSSProperties;
  bodyStyle: CSSProperties;
  dividerStyle: CSSProperties;
}

export const STANDARD_DESIGNS: BookingDesign[] = [
  {
    id: 1,
    designKey: 'classic',
    linkKey: 'bookingLink1',
    accent: 'linear-gradient(135deg, #7c3aed, #2563eb, #06b6d4)',
    squareStyle: {
      background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 58%, #06B6D4 100%)',
      color: 'rgba(255,255,255,0.96)',
      borderColor: 'rgba(255,255,255,0.22)',
      fontFamily: '"Nunito", var(--font-ui), Arial, sans-serif',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
    },
    badgeStyle: {
      background: 'rgba(255,255,255,0.18)',
      color: 'rgba(255,255,255,0.92)',
      borderColor: 'rgba(255,255,255,0.26)',
    },
    titleStyle: {
      color: '#FFFFFF',
      fontFamily: '"Nunito", var(--font-ui), Arial, sans-serif',
      fontWeight: 800,
    },
    subtitleStyle: { color: 'rgba(255,255,255,0.72)' },
    bodyStyle: { color: 'rgba(255,255,255,0.78)' },
    dividerStyle: {
      background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.08))',
    },
  },
  {
    id: 2,
    designKey: 'modern',
    linkKey: 'bookingLink2',
    accent: 'linear-gradient(135deg, #111827, #f43f5e)',
    squareStyle: {
      background: 'linear-gradient(135deg, #0F0F1A 0%, #1A0A1E 56%, #111827 100%)',
      color: '#F8FAFC',
      borderColor: 'rgba(244,63,94,0.28)',
      fontFamily: '"DM Sans", var(--font-ui), Arial, sans-serif',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    },
    badgeStyle: {
      background: 'rgba(244,63,94,0.12)',
      color: '#FDA4AF',
      borderColor: 'rgba(244,63,94,0.36)',
    },
    titleStyle: {
      color: '#F8FAFC',
      fontFamily: '"Clash Display", var(--font-ui), Arial, sans-serif',
      fontWeight: 400,
    },
    subtitleStyle: { color: 'rgba(248,250,252,0.6)' },
    bodyStyle: { color: 'rgba(248,250,252,0.68)' },
    dividerStyle: {
      background: 'linear-gradient(90deg, #F43F5E, rgba(244,63,94,0.05))',
    },
  },
  {
    id: 3,
    designKey: 'elegant',
    linkKey: 'bookingLink3',
    accent: 'linear-gradient(135deg, #3d2b1f, #c4956a)',
    squareStyle: {
      background: 'linear-gradient(180deg, rgba(196,149,106,0.12) 0%, #FFFFFF 22%, #FFFFFF 78%, rgba(196,149,106,0.08) 100%)',
      color: '#3D2B1F',
      borderColor: '#E8DDD1',
      fontFamily: 'Inter, var(--font-ui), Arial, sans-serif',
    },
    badgeStyle: {
      background: '#FAF7F2',
      color: '#9C8572',
      borderColor: '#E8DDD1',
    },
    titleStyle: {
      color: '#3D2B1F',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    subtitleStyle: { color: '#9C8572' },
    bodyStyle: { color: '#6F5A49' },
    dividerStyle: {
      background: '#C4956A',
    },
  },
];

export const PREMIUM_DESIGNS: BookingDesign[] = [
  {
    id: 4,
    designKey: 'seasonal',
    linkKey: 'bookingLink4',
    accent: 'linear-gradient(135deg, #38BDF8, #FACC15)',
    squareStyle: {
      background: 'linear-gradient(150deg, #E0F7FF 0%, #BAE6FD 58%, #F0F9FF 100%)',
      color: '#0F172A',
      borderColor: 'rgba(14,165,233,0.22)',
      fontFamily: '"Quicksand", var(--font-ui), Arial, sans-serif',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
    },
    badgeStyle: {
      background: 'rgba(255,255,255,0.62)',
      color: '#0F172A',
      borderColor: 'rgba(14,165,233,0.24)',
    },
    titleStyle: {
      color: '#0F172A',
      fontFamily: '"Quicksand", var(--font-ui), Arial, sans-serif',
      fontWeight: 700,
    },
    subtitleStyle: { color: 'rgba(15,23,42,0.72)' },
    bodyStyle: { color: 'rgba(15,23,42,0.72)' },
    dividerStyle: {
      background: 'linear-gradient(90deg, #0EA5E9, rgba(250,204,21,0.55), transparent)',
    },
  },
  {
    id: 5,
    designKey: 'magazine',
    linkKey: 'bookingLink5',
    accent: 'linear-gradient(135deg, #1a1a2e, #8b5cf6)',
    squareStyle: {
      background: '#FAFAF9',
      color: '#1A1A1A',
      borderColor: 'rgba(0,0,0,0.1)',
      fontFamily: 'Georgia, "Times New Roman", serif',
    },
    badgeStyle: {
      background: '#FFFFFF',
      color: '#6B6B6B',
      borderColor: 'rgba(0,0,0,0.12)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    titleStyle: {
      color: '#1A1A1A',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    subtitleStyle: {
      color: '#6B6B6B',
      fontStyle: 'italic',
    },
    bodyStyle: { color: '#525252' },
    dividerStyle: {
      borderTop: '1px dotted rgba(0,0,0,0.28)',
      background: 'transparent',
    },
  },
  {
    id: 6,
    designKey: 'casino',
    linkKey: 'bookingLink6',
    accent: 'linear-gradient(135deg, #a07830, #c9a84c, #e8c96d)',
    squareStyle: {
      background:
        'repeating-linear-gradient(45deg, rgba(201,168,76,0.018) 0 1px, transparent 1px 12px), repeating-linear-gradient(-45deg, rgba(201,168,76,0.012) 0 1px, transparent 1px 14px), radial-gradient(circle at 20% 20%, #145228 0%, transparent 34%), radial-gradient(circle at 80% 78%, #0D3B1E 0%, transparent 38%), #060F08',
      color: '#F5EDD6',
      borderColor: 'rgba(201,168,76,0.3)',
      fontFamily: 'Georgia, "Times New Roman", serif',
      boxShadow: 'inset 0 1px 0 rgba(232,201,109,0.13)',
    },
    badgeStyle: {
      background: 'rgba(201,168,76,0.12)',
      color: '#E8C96D',
      borderColor: 'rgba(201,168,76,0.38)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    titleStyle: {
      color: '#F5EDD6',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 700,
    },
    subtitleStyle: {
      color: '#C9A84C',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    bodyStyle: {
      color: '#E8D9B8',
      fontStyle: 'italic',
    },
    dividerStyle: {
      background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.75), transparent)',
    },
  },
];
