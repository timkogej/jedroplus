/**
 * Inicialke so izpisane v barvi zaposlenega, brez kroga okoli — preliv teče
 * skozi same črke.
 *
 * Dve pasti, zato ta helper obstaja:
 *
 * 1. `background` je kratka oblika (shorthand). Če jo postavimo v istem
 *    style objektu kot `backgroundClip`, React ob vsakem ponovnem izrisu
 *    javi opozorilo in lahko eno od obeh vrže stran. Zato tu uporabljamo
 *    izključno `backgroundImage`.
 * 2. `backgroundImage` ne sprejme navadne barve (`#7C78FA`). Barva zaposlenega
 *    je lahko hex ali že pripravljen preliv, zato enobarvno vrednost tu
 *    pretvorimo v preliv iz nje same.
 */

const FALLBACK = 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';

export function initialsStyle(color?: string | null): React.CSSProperties {
  const raw = color?.trim();
  const image = !raw
    ? FALLBACK
    : raw.includes('gradient')
      ? raw
      : `linear-gradient(135deg, ${raw} 0%, ${raw} 100%)`;

  return {
    backgroundImage: image,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };
}
