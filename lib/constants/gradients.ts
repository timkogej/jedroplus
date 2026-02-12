// Predefined color options for employee avatars
// Updated to use the same gradient palette as services for consistency

export interface ColorOption {
  id: number;
  name: string;
  value: string;
  gradient: string;
  colors: {
    start: string;
    end: string;
  };
}

// Same gradient palette as services (from serviceGradients.ts)
export const EMPLOYEE_GRADIENTS: ColorOption[] = [
  {
    id: 1,
    name: 'Ocean',
    value: '#06B6D4',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)',
    colors: { start: '#06B6D4', end: '#8B5CF6' },
  },
  {
    id: 2,
    name: 'Sunset',
    value: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 50%, #EF4444 100%)',
    colors: { start: '#F59E0B', end: '#EF4444' },
  },
  {
    id: 3,
    name: 'Aurora',
    value: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)',
    colors: { start: '#10B981', end: '#3B82F6' },
  },
  {
    id: 4,
    name: 'Berry',
    value: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 50%, #6366F1 100%)',
    colors: { start: '#EC4899', end: '#6366F1' },
  },
  {
    id: 5,
    name: 'Forest',
    value: '#22C55E',
    gradient: 'linear-gradient(135deg, #22C55E 0%, #10B981 50%, #059669 100%)',
    colors: { start: '#22C55E', end: '#059669' },
  },
  {
    id: 6,
    name: 'Candy',
    value: '#F472B6',
    gradient: 'linear-gradient(135deg, #F472B6 0%, #A855F7 50%, #06B6D4 100%)',
    colors: { start: '#F472B6', end: '#06B6D4' },
  },
  {
    id: 7,
    name: 'Fire',
    value: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #F97316 100%)',
    colors: { start: '#DC2626', end: '#F97316' },
  },
  {
    id: 8,
    name: 'Night',
    value: '#1E40AF',
    gradient: 'linear-gradient(135deg, #1E40AF 0%, #7C3AED 50%, #DB2777 100%)',
    colors: { start: '#1E40AF', end: '#DB2777' },
  },
  {
    id: 9,
    name: 'Tropical',
    value: '#14B8A6',
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #22C55E 50%, #84CC16 100%)',
    colors: { start: '#14B8A6', end: '#84CC16' },
  },
  {
    id: 10,
    name: 'Lavender',
    value: '#A78BFA',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #C084FC 50%, #E879F9 100%)',
    colors: { start: '#A78BFA', end: '#E879F9' },
  },
  {
    id: 11,
    name: 'Coral',
    value: '#FB7185',
    gradient: 'linear-gradient(135deg, #FB7185 0%, #F97316 50%, #FBBF24 100%)',
    colors: { start: '#FB7185', end: '#FBBF24' },
  },
  {
    id: 12,
    name: 'Mint',
    value: '#6EE7B7',
    gradient: 'linear-gradient(135deg, #6EE7B7 0%, #34D399 50%, #14B8A6 100%)',
    colors: { start: '#6EE7B7', end: '#14B8A6' },
  },
  {
    id: 13,
    name: 'Mocha',
    value: '#D4A574',
    gradient: 'linear-gradient(135deg, #D4A574 0%, #A0714F 50%, #6B4226 100%)',
    colors: { start: '#D4A574', end: '#6B4226' },
  },
  {
    id: 14,
    name: 'Charcoal',
    value: '#6B7280',
    gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 50%, #1F2937 100%)',
    colors: { start: '#6B7280', end: '#1F2937' },
  },
  {
    id: 15,
    name: 'Fuchsia',
    value: '#F472B6',
    gradient: 'linear-gradient(135deg, #F472B6 0%, #D946EF 50%, #8B5CF6 100%)',
    colors: { start: '#F472B6', end: '#8B5CF6' },
  },
  {
    id: 16,
    name: 'Sapphire',
    value: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1E3A8A 100%)',
    colors: { start: '#3B82F6', end: '#1E3A8A' },
  },
] as const;

// Keep STAFF_COLORS for backwards compatibility
export const STAFF_COLORS = EMPLOYEE_GRADIENTS.map((g) => ({
  name: g.name,
  value: g.value,
}));

// Keep GradientOption as alias for backwards compatibility
export type GradientOption = ColorOption;

export function getGradientById(id: number): ColorOption {
  return EMPLOYEE_GRADIENTS.find((g) => g.id === id) ?? EMPLOYEE_GRADIENTS[0];
}

export function getGradientStyle(id: number): string {
  return getGradientById(id).gradient;
}

// Get default gradient CSS string
export function getDefaultGradient(): string {
  return EMPLOYEE_GRADIENTS[0].gradient;
}

// Get default solid color value
export function getDefaultColor(): string {
  return EMPLOYEE_GRADIENTS[0].value;
}

// Check if a string is a valid gradient CSS
export function isValidGradient(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('linear-gradient(');
}

// Check if a string is a valid hex color
export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

// Check if a string is a valid color (hex or gradient)
export function isValidColor(value: string | null | undefined): boolean {
  return isValidGradient(value) || isValidHexColor(value);
}

// Get gradient option by CSS string
export function getGradientByCSS(css: string): ColorOption | undefined {
  return EMPLOYEE_GRADIENTS.find((g) => g.gradient === css);
}

// Get color option by hex value
export function getColorByValue(value: string): ColorOption | undefined {
  return EMPLOYEE_GRADIENTS.find((g) => g.value === value);
}

// Get background style (works for both hex colors and gradients)
export function getBackgroundStyle(value: string | null | undefined): string {
  if (!value) return EMPLOYEE_GRADIENTS[0].gradient;
  if (isValidHexColor(value)) return value;
  if (isValidGradient(value)) return value;
  // Try to find by value or gradient
  const found = EMPLOYEE_GRADIENTS.find((g) => g.value === value || g.gradient === value);
  return found?.gradient || EMPLOYEE_GRADIENTS[0].gradient;
}

// Get a random gradient for new employees
export function getRandomGradient(): string {
  const randomIndex = Math.floor(Math.random() * EMPLOYEE_GRADIENTS.length);
  return EMPLOYEE_GRADIENTS[randomIndex].gradient;
}

// Get a consistent gradient based on a string (like a name or ID)
export function getConsistentGradient(str: string): string {
  if (!str) return getDefaultGradient();

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const index = Math.abs(hash) % EMPLOYEE_GRADIENTS.length;
  return EMPLOYEE_GRADIENTS[index].gradient;
}
