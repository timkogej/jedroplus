/**
 * Skupni razredi Applovih okenc (list od spodaj na telefonu, okno na
 * računalniku): siva podlaga, prosojna glava in noga, bele skupine.
 *
 * Uporabljajo jih manjša potrditvena okenca (brisanje …), da so vsa enaka.
 */
export const sheet = {
  backdrop:
    'fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4',
  panel:
    'relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[#F2F2F7] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl',
  header: 'glass-bar border-b border-gray-200/70 px-5 py-3.5 sm:px-6',
  grabber: 'mx-auto mb-2 h-1 w-9 rounded-full bg-gray-300 sm:hidden',
  title: 'text-[17px] font-semibold text-gray-900',
  subtitle: 'mt-0.5 text-[13px] text-gray-500',
  close:
    'rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50',
  body: 'min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5',
  group: 'rounded-xl bg-white p-4',
  footer:
    'glass-bar flex flex-shrink-0 items-center justify-end gap-3 border-t border-gray-200/70 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6',
  cancel:
    'flex-1 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 sm:flex-none',
  /** Osnova za glavni gumb; barvo (gradient) doda vsako okence samo. */
  action:
    'flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-70 sm:flex-none',
} as const;
