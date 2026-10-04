/**
 * Mere stikal na enem mestu: na telefonu iOS (tir 51×31, gumb 27, pot 20),
 * na računalniku macOS (tir 36×20, gumb 16, pot 16). iOS mere na namizju
 * delujejo napihnjeno, macOS mere na telefonu pa so premajhne za prst.
 *
 * Barve tira (vklop/izklop) določi vsako stikalo samo.
 */
export const switchTrack =
  'relative inline-flex h-[31px] w-[51px] flex-shrink-0 items-center rounded-full transition-colors duration-200 sm:h-5 sm:w-9';

export const switchKnob = (checked: boolean) =>
  `pointer-events-none inline-block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.18),0_0_1px_rgba(0,0,0,0.12)] transition-transform duration-200 sm:h-4 sm:w-4 ${
    checked ? 'translate-x-[22px] sm:translate-x-[18px]' : 'translate-x-[2px]'
  }`;
