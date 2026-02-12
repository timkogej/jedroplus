// Gradient palette for services
// Each gradient is stored as a full CSS gradient string

export interface ServiceGradient {
  id: number;
  name: string;
  gradient: string;
  preview: {
    start: string;
    end: string;
  };
}

export const SERVICE_GRADIENTS: ServiceGradient[] = [
  // Multi-color gradients (3+ colors) for vibrant, modern look
  {
    id: 1,
    name: 'Ocean',
    // Turkizno-modro-vijolična
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)',
    preview: { start: '#06B6D4', end: '#8B5CF6' },
  },
  {
    id: 2,
    name: 'Sunset',
    // Oranžno-roza-rdeča
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 50%, #EF4444 100%)',
    preview: { start: '#F59E0B', end: '#EF4444' },
  },
  {
    id: 3,
    name: 'Aurora',
    // Zeleno-turkizno-modra
    gradient: 'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)',
    preview: { start: '#10B981', end: '#3B82F6' },
  },
  {
    id: 4,
    name: 'Berry',
    // Roza-vijolična-modra
    gradient: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 50%, #6366F1 100%)',
    preview: { start: '#EC4899', end: '#6366F1' },
  },
  {
    id: 5,
    name: 'Forest',
    // Zeleno-smaragdno
    gradient: 'linear-gradient(135deg, #22C55E 0%, #10B981 50%, #059669 100%)',
    preview: { start: '#22C55E', end: '#059669' },
  },
  {
    id: 6,
    name: 'Candy',
    // Roza-vijolična-turkizna
    gradient: 'linear-gradient(135deg, #F472B6 0%, #A855F7 50%, #06B6D4 100%)',
    preview: { start: '#F472B6', end: '#06B6D4' },
  },
  {
    id: 7,
    name: 'Fire',
    // Rdeče-oranžna
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #F97316 100%)',
    preview: { start: '#DC2626', end: '#F97316' },
  },
  {
    id: 8,
    name: 'Night',
    // Temno modra-vijolična-roza
    gradient: 'linear-gradient(135deg, #1E40AF 0%, #7C3AED 50%, #DB2777 100%)',
    preview: { start: '#1E40AF', end: '#DB2777' },
  },
  {
    id: 9,
    name: 'Tropical',
    // Turkizna-zelena-rumena
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #22C55E 50%, #84CC16 100%)',
    preview: { start: '#14B8A6', end: '#84CC16' },
  },
  {
    id: 10,
    name: 'Lavender',
    // Svetlo vijolična-roza
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #C084FC 50%, #E879F9 100%)',
    preview: { start: '#A78BFA', end: '#E879F9' },
  },
  {
    id: 11,
    name: 'Coral',
    // Koralna-oranžna-rumena
    gradient: 'linear-gradient(135deg, #FB7185 0%, #F97316 50%, #FBBF24 100%)',
    preview: { start: '#FB7185', end: '#FBBF24' },
  },
  {
    id: 12,
    name: 'Mint',
    // Mint zelena-turkizna
    gradient: 'linear-gradient(135deg, #6EE7B7 0%, #34D399 50%, #14B8A6 100%)',
    preview: { start: '#6EE7B7', end: '#14B8A6' },
  },
  {
    id: 13,
    name: 'Mocha',
    // Svetlo rjava-temno rjava
    gradient: 'linear-gradient(135deg, #D4A574 0%, #A0714F 50%, #6B4226 100%)',
    preview: { start: '#D4A574', end: '#6B4226' },
  },
  {
    id: 14,
    name: 'Charcoal',
    // Temno siva
    gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 50%, #1F2937 100%)',
    preview: { start: '#6B7280', end: '#1F2937' },
  },
  {
    id: 15,
    name: 'Fuchsia',
    // Rozno-vijolična
    gradient: 'linear-gradient(135deg, #F472B6 0%, #D946EF 50%, #8B5CF6 100%)',
    preview: { start: '#F472B6', end: '#8B5CF6' },
  },
  {
    id: 16,
    name: 'Sapphire',
    // Temno modra
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1E3A8A 100%)',
    preview: { start: '#3B82F6', end: '#1E3A8A' },
  },
];

// Default gradient for new services
export const DEFAULT_SERVICE_GRADIENT = SERVICE_GRADIENTS[0].gradient; // Ocean (turkizno-modro-vijolična)

// Helper to check if a value is a valid gradient
export function isGradient(value: string): boolean {
  return value?.startsWith('linear-gradient') || value?.startsWith('radial-gradient');
}

// Helper to get a fallback color from a gradient for non-gradient contexts
export function getGradientStartColor(gradient: string): string {
  const match = gradient.match(/#[A-Fa-f0-9]{6}/);
  return match ? match[0] : '#8B5CF6';
}

// Get a random gradient for new clients or services
export function getRandomGradient(): string {
  const randomIndex = Math.floor(Math.random() * SERVICE_GRADIENTS.length);
  return SERVICE_GRADIENTS[randomIndex].gradient;
}

// Get a consistent gradient based on a string (like a name or ID)
// This ensures the same string always gets the same color
export function getConsistentGradient(str: string): string {
  if (!str) return DEFAULT_SERVICE_GRADIENT;

  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % SERVICE_GRADIENTS.length;
  return SERVICE_GRADIENTS[index].gradient;
}
