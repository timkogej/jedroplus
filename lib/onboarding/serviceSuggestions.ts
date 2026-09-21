// lib/onboarding/serviceSuggestions.ts
//
// Starter services offered in onboarding, keyed by the industry key used in
// app/[locale]/onboarding/create/page.tsx (PANOGE_DATA[].key). They are only
// suggestions: the owner confirms, edits or unticks each one before anything
// is created, so what lands in the account is their own data, not demo data.

export interface ServiceSuggestion {
  name: { sl: string; en: string };
  durationMin: number;
  priceEur: number;
}

const s = (sl: string, en: string, durationMin: number, priceEur: number): ServiceSuggestion => ({
  name: { sl, en },
  durationMin,
  priceEur,
});

export const SERVICE_SUGGESTIONS: Record<string, ServiceSuggestion[]> = {
  hairSalons: [
    s('Žensko striženje', "Women's haircut", 45, 30),
    s('Moško striženje', "Men's haircut", 30, 18),
    s('Barvanje las', 'Hair colouring', 90, 55),
    s('Feniranje', 'Blow-dry', 30, 20),
  ],
  cosmeticsAndSkincare: [
    s('Klasična nega obraza', 'Classic facial', 60, 45),
    s('Globinsko čiščenje obraza', 'Deep cleansing facial', 75, 55),
    s('Oblikovanje obrvi', 'Brow shaping', 20, 12),
    s('Depilacija nog', 'Leg waxing', 45, 30),
  ],
  massageAndWellness: [
    s('Klasična masaža (60 min)', 'Classic massage (60 min)', 60, 45),
    s('Športna masaža', 'Sports massage', 60, 50),
    s('Masaža hrbta in vratu', 'Back and neck massage', 30, 28),
    s('Refleksna masaža stopal', 'Foot reflexology', 45, 35),
  ],
  dentistry: [
    s('Pregled', 'Check-up', 30, 35),
    s('Čiščenje zobnega kamna', 'Scale and polish', 45, 60),
    s('Zalivka', 'Filling', 45, 80),
  ],
  medicineAndHealth: [
    s('Prvi pregled', 'Initial consultation', 30, 50),
    s('Kontrolni pregled', 'Follow-up visit', 20, 35),
  ],
  physiotherapy: [
    s('Prva obravnava', 'Initial assessment', 60, 55),
    s('Fizioterapevtska obravnava', 'Physiotherapy session', 45, 45),
    s('Kinezioterapija', 'Exercise therapy', 45, 40),
  ],
  psychologyAndCoaching: [
    s('Uvodni pogovor', 'Intro session', 30, 0),
    s('Individualno srečanje', 'Individual session', 50, 60),
    s('Coaching srečanje', 'Coaching session', 60, 70),
  ],
  veterinary: [
    s('Splošni pregled', 'General check-up', 30, 35),
    s('Cepljenje', 'Vaccination', 20, 30),
    s('Striženje krempljev', 'Nail trim', 15, 10),
  ],
  personalTrainingFitness: [
    s('Osebni trening', 'Personal training session', 60, 35),
    s('Uvodno testiranje', 'Initial assessment', 45, 25),
    s('Trening v paru', 'Partner training', 60, 50),
  ],
  yogaAndPilates: [
    s('Individualna ura joge', 'Private yoga class', 60, 40),
    s('Pilates (individualno)', 'Private pilates class', 55, 40),
    s('Skupinska vadba', 'Group class', 60, 12),
  ],
  beautySalon: [
    s('Manikura z lakiranjem', 'Manicure with polish', 60, 30),
    s('Klasična nega obraza', 'Classic facial', 60, 45),
    s('Oblikovanje obrvi', 'Brow shaping', 20, 12),
    s('Pedikura', 'Pedicure', 45, 30),
  ],
  manicureAndPedicure: [
    s('Manikura z lakiranjem', 'Manicure with polish', 60, 30),
    s('Gel lak', 'Gel polish', 60, 35),
    s('Pedikura', 'Pedicure', 45, 30),
    s('Odstranitev gel laka', 'Gel polish removal', 20, 10),
  ],
  tattoosAndPiercings: [
    s('Posvet in skica', 'Consultation and sketch', 30, 0),
    s('Manjša tetovaža', 'Small tattoo', 60, 80),
    s('Piercing', 'Piercing', 20, 30),
  ],
  architectureAndDesign: [
    s('Uvodni posvet', 'Initial consultation', 60, 0),
    s('Ogled prostora', 'Site visit', 90, 60),
  ],
  photography: [
    s('Portretno fotografiranje', 'Portrait session', 60, 90),
    s('Družinsko fotografiranje', 'Family session', 90, 140),
  ],
  lawAndConsulting: [
    s('Uvodni posvet', 'Initial consultation', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 60, 80),
  ],
  accounting: [
    s('Uvodni posvet', 'Initial consultation', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 60, 60),
  ],
  itServices: [
    s('Uvodni posvet', 'Initial consultation', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 60, 60),
  ],
  educationAndTutoring: [
    s('Inštrukcije (45 min)', 'Tutoring (45 min)', 45, 20),
    s('Inštrukcije (90 min)', 'Tutoring (90 min)', 90, 38),
  ],
  carService: [
    s('Menjava pnevmatik', 'Tyre change', 30, 30),
    s('Mali servis', 'Basic service', 60, 90),
    s('Menjava olja', 'Oil change', 30, 50),
  ],
  cleaningAndMaintenance: [
    s('Čiščenje stanovanja', 'Apartment cleaning', 120, 60),
    s('Generalno čiščenje', 'Deep cleaning', 240, 140),
  ],
  other: [
    s('Posvet', 'Consultation', 30, 0),
    s('Storitev (1 ura)', 'Service (1 hour)', 60, 40),
  ],
};

export function getServiceSuggestions(industryKey: string | null | undefined): ServiceSuggestion[] {
  if (!industryKey) return SERVICE_SUGGESTIONS.other;
  return SERVICE_SUGGESTIONS[industryKey] ?? SERVICE_SUGGESTIONS.other;
}
