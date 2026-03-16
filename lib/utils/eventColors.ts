import type { CSSProperties } from 'react';

/**
 * Returns true if the color string is a CSS gradient.
 */
export function isGradient(colorString: string): boolean {
  return typeof colorString === 'string' && colorString.includes('gradient');
}

/**
 * Extracts the first hex color stop from a gradient string,
 * or returns the original string if it's a solid color.
 */
export function extractFirstColorStop(colorString: string): string {
  if (!colorString) return '#6D5EF7';
  if (!isGradient(colorString)) return colorString;
  const match = colorString.match(/#[0-9A-Fa-f]{6}/);
  return match ? match[0] : '#6D5EF7';
}

/**
 * Returns the CSS style needed to render a gradient border using
 * the "gradient wrapper + inner white content" technique.
 * Apply this to the outer wrapper element.
 */
export function getEventBorderWrapperStyle(colorString: string): CSSProperties {
  return { background: colorString || '#6D5EF7' };
}

/**
 * Returns the CSS style for the event title text using the event color.
 * - For gradients: gradient text clip technique
 * - For solid colors: plain color
 */
export function getEventTitleStyle(colorString: string): CSSProperties {
  if (!colorString) return { color: '#6D5EF7' };
  if (isGradient(colorString)) {
    return {
      backgroundImage: colorString,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    };
  }
  return { color: colorString };
}

/**
 * Curated gradient color options for the event form color picker.
 */
export const EVENT_COLOR_PRESETS: { label: string; value: string }[] = [
  {
    label: 'Ocean',
    value: 'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)',
  },
  {
    label: 'Nebula',
    value: 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 50%, #F43F5E 100%)',
  },
  {
    label: 'Sunset',
    value: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  },
  {
    label: 'Sky',
    value: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
  },
  {
    label: 'Forest',
    value: 'linear-gradient(135deg, #22C55E 0%, #84CC16 100%)',
  },
  {
    label: 'Rose',
    value: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
  },
  {
    label: 'Midnight',
    value: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
  },
  {
    label: 'Teal',
    value: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 50%, #5EEAD4 100%)',
  },
];
