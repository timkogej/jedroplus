// Color utility functions for gradient generation and color manipulation

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB values to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Darken a hex color by a percentage
 * @param hex - The hex color to darken
 * @param percent - The percentage to darken (0-100)
 */
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = 1 - percent / 100;
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  );
}

/**
 * Lighten a hex color by a percentage
 * @param hex - The hex color to lighten
 * @param percent - The percentage to lighten (0-100)
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}

/**
 * Generate a gradient CSS string from a base color
 * @param baseColor - The base hex color
 * @param darkenPercent - How much to darken the end color (default: 20)
 */
export function generateGradient(baseColor: string, darkenPercent: number = 20): string {
  const darkColor = darkenColor(baseColor, darkenPercent);
  return `linear-gradient(135deg, ${baseColor}, ${darkColor})`;
}

/**
 * Get complementary colors based on color theory
 * @param hex - The base hex color
 * @returns Array of 3 complementary colors
 */
export function getComplementaryColors(hex: string): string[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [hex, hex, hex];

  // Convert RGB to HSL
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Generate complementary colors
  const colors: string[] = [];

  // Triadic colors (120 degrees apart)
  for (let i = 1; i <= 3; i++) {
    const newH = (h + i * 0.333) % 1;
    colors.push(hslToHex(newH, s, l));
  }

  return colors;
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return rgbToHex(r * 255, g * 255, b * 255);
}

/**
 * Check if a color is dark or light
 * @param hex - The hex color to check
 * @returns true if the color is dark, false if light
 */
export function isColorDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;

  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

/**
 * Get appropriate text color (black or white) based on background
 * @param backgroundHex - The background hex color
 * @returns "#FFFFFF" for dark backgrounds, "#1A1F36" for light backgrounds
 */
export function getContrastTextColor(backgroundHex: string): string {
  return isColorDark(backgroundHex) ? '#FFFFFF' : '#1A1F36';
}
