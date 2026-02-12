export interface GradientStop {
  color: string;
  offset: number;
}

export interface ParsedGradient {
  angle: number;
  stops: GradientStop[];
}

function splitGradientParts(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function parseLinearGradient(input: string): ParsedGradient | null {
  if (!input || !input.toLowerCase().startsWith('linear-gradient(')) {
    return null;
  }

  const inner = input.slice('linear-gradient('.length, -1).trim();
  if (!inner) return null;

  const parts = splitGradientParts(inner);
  if (parts.length === 0) return null;

  let angle = 180;
  let stopParts = parts;

  if (parts[0].toLowerCase().endsWith('deg')) {
    const parsedAngle = parseFloat(parts[0]);
    if (!Number.isNaN(parsedAngle)) {
      angle = parsedAngle;
    }
    stopParts = parts.slice(1);
  }

  const rawStops = stopParts
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return null;

      const match = trimmed.match(/^(.*?)(?:\s+([\d.]+)%?)?$/);
      if (!match) return null;

      const color = match[1].trim();
      const offsetRaw = match[2];
      const offset = offsetRaw ? parseFloat(offsetRaw) / 100 : null;

      return { color, offset };
    })
    .filter((stop): stop is { color: string; offset: number | null } => Boolean(stop));

  if (rawStops.length === 0) return null;

  const stops = rawStops.map((stop, index) => {
    let offset = stop.offset;
    if (offset === null || Number.isNaN(offset)) {
      offset = rawStops.length === 1 ? 0 : index / (rawStops.length - 1);
    }

    return {
      color: stop.color,
      offset: Math.min(1, Math.max(0, offset)),
    };
  });

  return { angle, stops };
}

export function getSvgGradientCoords(angle: number): {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
} {
  const radians = (angle - 90) * (Math.PI / 180);
  const x = Math.cos(radians);
  const y = Math.sin(radians);

  const x1 = 0.5 - x / 2;
  const y1 = 0.5 - y / 2;
  const x2 = 0.5 + x / 2;
  const y2 = 0.5 + y / 2;

  return {
    x1: x1.toString(),
    y1: y1.toString(),
    x2: x2.toString(),
    y2: y2.toString(),
  };
}
