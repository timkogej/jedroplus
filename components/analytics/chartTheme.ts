/**
 * Skupne nastavitve za Recharts.
 *
 * Osi, mreža in oblaček so bili v vsakem grafu napisani znova in se niso
 * povsem ujemali. Tu so enkrat, da so vsi grafi videti kot en sistem.
 */

export const AXIS = {
  tick: { fontSize: 12, fill: '#8E8E93' },
  stroke: '#D1D1D6',
  tickLine: false,
  axisLine: false,
} as const;

export const GRID = {
  strokeDasharray: '3 3',
  stroke: '#F2F2F7',
  vertical: false,
} as const;

export const TOOLTIP = {
  contentStyle: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    backdropFilter: 'saturate(180%) blur(20px)',
    border: '1px solid #F2F2F7',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    fontSize: '13px',
  },
  labelStyle: { color: '#1C1C1E', fontWeight: 600, marginBottom: 4 },
  cursor: { fill: 'rgba(0,0,0,0.04)' },
} as const;

/**
 * Grafi se ne animirajo. V zavihku v ozadju brskalnik zaduši sličice in
 * stolpci obtičijo pri nič — kar je videti kot napaka v podatkih.
 */
export const NO_ANIM = { isAnimationActive: false } as const;

export const BRAND = {
  violet: '#7C78FA',
  cyan: '#35E3DB',
  blue: '#59AEEA',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
} as const;
