import type { MetadataRoute } from 'next';

// PWA manifest. `id` in `scope` naj ostaneta nespremenjena — po njiju brskalnik
// prepozna že nameščeno aplikacijo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Jedro+',
    short_name: 'Jedro+',
    description: 'Termini, stranke in obvestila salona na enem mestu.',
    lang: 'sl',
    dir: 'ltr',
    icons: [
      {
        src: '/android-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/maskable-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/jedro-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['business', 'productivity'],
    shortcuts: [
      { name: 'Koledar', url: '/koledar', icons: [{ src: '/android-icon-192.png', sizes: '192x192' }] },
      { name: 'Obvestila', url: '/obvestila', icons: [{ src: '/android-icon-192.png', sizes: '192x192' }] },
    ],
  };
}
