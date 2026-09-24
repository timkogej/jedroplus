// lib/onboarding/serviceSuggestions.ts
//
// Starter services offered in onboarding, keyed by the industry key used in
// app/[locale]/onboarding/create/page.tsx (PANOGE_DATA[].key). They are only
// suggestions: the owner confirms, edits or unticks each one before anything
// is created, so what lands in the account is their own data, not demo data.

export interface ServiceSuggestion {
  name: { sl: string; en: string; de: string };
  durationMin: number;
  priceEur: number;
}

const s = (sl: string, en: string, de: string, durationMin: number, priceEur: number): ServiceSuggestion => ({
  name: { sl, en, de },
  durationMin,
  priceEur,
});

export const SERVICE_SUGGESTIONS: Record<string, ServiceSuggestion[]> = {
  hairSalons: [
    s('Žensko striženje', "Women's haircut", 'Damenhaarschnitt', 45, 30),
    s('Moško striženje', "Men's haircut", 'Herrenhaarschnitt', 30, 18),
    s('Barvanje las', 'Hair colouring', 'Haare färben', 90, 55),
    s('Feniranje', 'Blow-dry', 'Föhnen', 30, 20),
  ],
  cosmeticsAndSkincare: [
    s('Klasična nega obraza', 'Classic facial', 'Klassische Gesichtsbehandlung', 60, 45),
    s('Globinsko čiščenje obraza', 'Deep cleansing facial', 'Tiefenreinigung Gesicht', 75, 55),
    s('Oblikovanje obrvi', 'Brow shaping', 'Augenbrauen zupfen', 20, 12),
    s('Depilacija nog', 'Leg waxing', 'Beinenthaarung (Wachs)', 45, 30),
  ],
  massageAndWellness: [
    s('Klasična masaža (60 min)', 'Classic massage (60 min)', 'Klassische Massage (60 Min.)', 60, 45),
    s('Športna masaža', 'Sports massage', 'Sportmassage', 60, 50),
    s('Masaža hrbta in vratu', 'Back and neck massage', 'Rücken- und Nackenmassage', 30, 28),
    s('Refleksna masaža stopal', 'Foot reflexology', 'Fußreflexzonenmassage', 45, 35),
  ],
  dentistry: [
    s('Pregled', 'Check-up', 'Kontrolluntersuchung', 30, 35),
    s('Čiščenje zobnega kamna', 'Scale and polish', 'Zahnreinigung', 45, 60),
    s('Zalivka', 'Filling', 'Füllung', 45, 80),
  ],
  medicineAndHealth: [
    s('Prvi pregled', 'Initial consultation', 'Erstberatung', 30, 50),
    s('Kontrolni pregled', 'Follow-up visit', 'Kontrolltermin', 20, 35),
  ],
  physiotherapy: [
    s('Prva obravnava', 'Initial assessment', 'Erstbefund', 60, 55),
    s('Fizioterapevtska obravnava', 'Physiotherapy session', 'Physiotherapie', 45, 45),
    s('Kinezioterapija', 'Exercise therapy', 'Bewegungstherapie', 45, 40),
  ],
  psychologyAndCoaching: [
    s('Uvodni pogovor', 'Intro session', 'Kennenlerngespräch', 30, 0),
    s('Individualno srečanje', 'Individual session', 'Einzelsitzung', 50, 60),
    s('Coaching srečanje', 'Coaching session', 'Coaching-Sitzung', 60, 70),
  ],
  veterinary: [
    s('Splošni pregled', 'General check-up', 'Allgemeine Untersuchung', 30, 35),
    s('Cepljenje', 'Vaccination', 'Impfung', 20, 30),
    s('Striženje krempljev', 'Nail trim', 'Krallen schneiden', 15, 10),
  ],
  personalTrainingFitness: [
    s('Osebni trening', 'Personal training session', 'Personal Training', 60, 35),
    s('Uvodno testiranje', 'Initial assessment', 'Erstbefund', 45, 25),
    s('Trening v paru', 'Partner training', 'Partnertraining', 60, 50),
  ],
  yogaAndPilates: [
    s('Individualna ura joge', 'Private yoga class', 'Yoga-Einzelstunde', 60, 40),
    s('Pilates (individualno)', 'Private pilates class', 'Pilates (Einzelstunde)', 55, 40),
    s('Skupinska vadba', 'Group class', 'Gruppenkurs', 60, 12),
  ],
  beautySalon: [
    s('Manikura z lakiranjem', 'Manicure with polish', 'Maniküre mit Lack', 60, 30),
    s('Klasična nega obraza', 'Classic facial', 'Klassische Gesichtsbehandlung', 60, 45),
    s('Oblikovanje obrvi', 'Brow shaping', 'Augenbrauen zupfen', 20, 12),
    s('Pedikura', 'Pedicure', 'Pediküre', 45, 30),
  ],
  manicureAndPedicure: [
    s('Manikura z lakiranjem', 'Manicure with polish', 'Maniküre mit Lack', 60, 30),
    s('Gel lak', 'Gel polish', 'Gel-Lack', 60, 35),
    s('Pedikura', 'Pedicure', 'Pediküre', 45, 30),
    s('Odstranitev gel laka', 'Gel polish removal', 'Gel-Lack entfernen', 20, 10),
  ],
  tattoosAndPiercings: [
    s('Posvet in skica', 'Consultation and sketch', 'Beratung und Entwurf', 30, 0),
    s('Manjša tetovaža', 'Small tattoo', 'Kleines Tattoo', 60, 80),
    s('Piercing', 'Piercing', 'Piercing', 20, 30),
  ],
  architectureAndDesign: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 60, 0),
    s('Ogled prostora', 'Site visit', 'Vor-Ort-Termin', 90, 60),
  ],
  photography: [
    s('Portretno fotografiranje', 'Portrait session', 'Porträtshooting', 60, 90),
    s('Družinsko fotografiranje', 'Family session', 'Familienshooting', 90, 140),
  ],
  lawAndConsulting: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 'Beratung (1 Stunde)', 60, 80),
  ],
  accounting: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 'Beratung (1 Stunde)', 60, 60),
  ],
  itServices: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 'Beratung (1 Stunde)', 60, 60),
  ],
  educationAndTutoring: [
    s('Inštrukcije (45 min)', 'Tutoring (45 min)', 'Nachhilfe (45 Min.)', 45, 20),
    s('Inštrukcije (90 min)', 'Tutoring (90 min)', 'Nachhilfe (90 Min.)', 90, 38),
  ],
  carService: [
    s('Menjava pnevmatik', 'Tyre change', 'Reifenwechsel', 30, 30),
    s('Mali servis', 'Basic service', 'Kleine Inspektion', 60, 90),
    s('Menjava olja', 'Oil change', 'Ölwechsel', 30, 50),
  ],
  cleaningAndMaintenance: [
    s('Čiščenje stanovanja', 'Apartment cleaning', 'Wohnungsreinigung', 120, 60),
    s('Generalno čiščenje', 'Deep cleaning', 'Grundreinigung', 240, 140),
  ],
  other: [
    s('Posvet', 'Consultation', 'Beratung', 30, 0),
    s('Storitev (1 ura)', 'Service (1 hour)', 'Leistung (1 Stunde)', 60, 40),
  ],
};

export function getServiceSuggestions(industryKey: string | null | undefined): ServiceSuggestion[] {
  if (!industryKey) return SERVICE_SUGGESTIONS.other;
  return SERVICE_SUGGESTIONS[industryKey] ?? SERVICE_SUGGESTIONS.other;
}
