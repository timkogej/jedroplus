// lib/onboarding/serviceSuggestions.ts
//
// Starter services offered in onboarding, keyed by the industry key used in
// app/[locale]/onboarding/create/page.tsx (PANOGE_DATA[].key). They are only
// suggestions: the owner confirms, edits or unticks each one before anything
// is created, so what lands in the account is their own data, not demo data.

export interface ServiceSuggestion {
  name: { sl: string; en: string; de: string; hr: string; it: string };
  durationMin: number;
  priceEur: number;
}

const s = (
  sl: string, en: string, de: string, hr: string, it: string,
  durationMin: number, priceEur: number,
): ServiceSuggestion => ({
  name: { sl, en, de, hr, it },
  durationMin,
  priceEur,
});

export const SERVICE_SUGGESTIONS: Record<string, ServiceSuggestion[]> = {
  hairSalons: [
    s('Žensko striženje', "Women's haircut", 'Damenhaarschnitt', 'Žensko šišanje', 'Taglio donna', 45, 30),
    s('Moško striženje', "Men's haircut", 'Herrenhaarschnitt', 'Muško šišanje', 'Taglio uomo', 30, 18),
    s('Barvanje las', 'Hair colouring', 'Haare färben', 'Bojanje kose', 'Colore', 90, 55),
    s('Feniranje', 'Blow-dry', 'Föhnen', 'Feniranje', 'Piega', 30, 20),
  ],
  cosmeticsAndSkincare: [
    s('Klasična nega obraza', 'Classic facial', 'Klassische Gesichtsbehandlung', 'Klasični tretman lica', 'Trattamento viso classico', 60, 45),
    s('Globinsko čiščenje obraza', 'Deep cleansing facial', 'Tiefenreinigung Gesicht', 'Dubinsko čišćenje lica', 'Pulizia viso profonda', 75, 55),
    s('Oblikovanje obrvi', 'Brow shaping', 'Augenbrauen zupfen', 'Oblikovanje obrva', 'Modellatura sopracciglia', 20, 12),
    s('Depilacija nog', 'Leg waxing', 'Beinenthaarung (Wachs)', 'Depilacija nogu', 'Ceretta gambe', 45, 30),
  ],
  massageAndWellness: [
    s('Klasična masaža (60 min)', 'Classic massage (60 min)', 'Klassische Massage (60 Min.)', 'Klasična masaža (60 min)', 'Massaggio classico (60 min)', 60, 45),
    s('Športna masaža', 'Sports massage', 'Sportmassage', 'Sportska masaža', 'Massaggio sportivo', 60, 50),
    s('Masaža hrbta in vratu', 'Back and neck massage', 'Rücken- und Nackenmassage', 'Masaža leđa i vrata', 'Massaggio schiena e collo', 30, 28),
    s('Refleksna masaža stopal', 'Foot reflexology', 'Fußreflexzonenmassage', 'Refleksna masaža stopala', 'Riflessologia plantare', 45, 35),
  ],
  dentistry: [
    s('Pregled', 'Check-up', 'Kontrolluntersuchung', 'Pregled', 'Visita di controllo', 30, 35),
    s('Čiščenje zobnega kamna', 'Scale and polish', 'Zahnreinigung', 'Čišćenje zubnog kamenca', 'Pulizia dei denti (ablazione tartaro)', 45, 60),
    s('Zalivka', 'Filling', 'Füllung', 'Plomba', 'Otturazione', 45, 80),
  ],
  medicineAndHealth: [
    s('Prvi pregled', 'Initial consultation', 'Erstberatung', 'Prvi pregled', 'Prima visita', 30, 50),
    s('Kontrolni pregled', 'Follow-up visit', 'Kontrolltermin', 'Kontrolni pregled', 'Visita di controllo', 20, 35),
  ],
  physiotherapy: [
    s('Prva obravnava', 'Initial assessment', 'Erstbefund', 'Prva procjena', 'Valutazione iniziale', 60, 55),
    s('Fizioterapevtska obravnava', 'Physiotherapy session', 'Physiotherapie', 'Fizioterapijski tretman', 'Seduta di fisioterapia', 45, 45),
    s('Kinezioterapija', 'Exercise therapy', 'Bewegungstherapie', 'Kineziterapija', 'Chinesiterapia', 45, 40),
  ],
  psychologyAndCoaching: [
    s('Uvodni pogovor', 'Intro session', 'Kennenlerngespräch', 'Uvodni razgovor', 'Colloquio conoscitivo', 30, 0),
    s('Individualno srečanje', 'Individual session', 'Einzelsitzung', 'Individualni susret', 'Seduta individuale', 50, 60),
    s('Coaching srečanje', 'Coaching session', 'Coaching-Sitzung', 'Coaching susret', 'Sessione di coaching', 60, 70),
  ],
  veterinary: [
    s('Splošni pregled', 'General check-up', 'Allgemeine Untersuchung', 'Opći pregled', 'Visita generale', 30, 35),
    s('Cepljenje', 'Vaccination', 'Impfung', 'Cijepljenje', 'Vaccinazione', 20, 30),
    s('Striženje krempljev', 'Nail trim', 'Krallen schneiden', 'Rezanje noktiju', 'Taglio unghie', 15, 10),
  ],
  personalTrainingFitness: [
    s('Osebni trening', 'Personal training session', 'Personal Training', 'Osobni trening', 'Allenamento personale', 60, 35),
    s('Uvodno testiranje', 'Initial assessment', 'Erstbefund', 'Početno testiranje', 'Test iniziale', 45, 25),
    s('Trening v paru', 'Partner training', 'Partnertraining', 'Trening u paru', 'Allenamento in coppia', 60, 50),
  ],
  yogaAndPilates: [
    s('Individualna ura joge', 'Private yoga class', 'Yoga-Einzelstunde', 'Individualni sat joge', 'Lezione individuale di yoga', 60, 40),
    s('Pilates (individualno)', 'Private pilates class', 'Pilates (Einzelstunde)', 'Pilates (individualno)', 'Pilates (individuale)', 55, 40),
    s('Skupinska vadba', 'Group class', 'Gruppenkurs', 'Grupni trening', 'Lezione di gruppo', 60, 12),
  ],
  beautySalon: [
    s('Manikura z lakiranjem', 'Manicure with polish', 'Maniküre mit Lack', 'Manikura s lakiranjem', 'Manicure con smalto', 60, 30),
    s('Klasična nega obraza', 'Classic facial', 'Klassische Gesichtsbehandlung', 'Klasični tretman lica', 'Trattamento viso classico', 60, 45),
    s('Oblikovanje obrvi', 'Brow shaping', 'Augenbrauen zupfen', 'Oblikovanje obrva', 'Modellatura sopracciglia', 20, 12),
    s('Pedikura', 'Pedicure', 'Pediküre', 'Pedikura', 'Pedicure', 45, 30),
  ],
  manicureAndPedicure: [
    s('Manikura z lakiranjem', 'Manicure with polish', 'Maniküre mit Lack', 'Manikura s lakiranjem', 'Manicure con smalto', 60, 30),
    s('Gel lak', 'Gel polish', 'Gel-Lack', 'Gel lak', 'Semipermanente', 60, 35),
    s('Pedikura', 'Pedicure', 'Pediküre', 'Pedikura', 'Pedicure', 45, 30),
    s('Odstranitev gel laka', 'Gel polish removal', 'Gel-Lack entfernen', 'Skidanje gel laka', 'Rimozione semipermanente', 20, 10),
  ],
  tattoosAndPiercings: [
    s('Posvet in skica', 'Consultation and sketch', 'Beratung und Entwurf', 'Konzultacije i skica', 'Consulenza e bozzetto', 30, 0),
    s('Manjša tetovaža', 'Small tattoo', 'Kleines Tattoo', 'Manja tetovaža', 'Tatuaggio piccolo', 60, 80),
    s('Piercing', 'Piercing', 'Piercing', 'Piercing', 'Piercing', 20, 30),
  ],
  architectureAndDesign: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 'Uvodne konzultacije', 'Consulenza iniziale', 60, 0),
    s('Ogled prostora', 'Site visit', 'Vor-Ort-Termin', 'Obilazak prostora', 'Sopralluogo', 90, 60),
  ],
  photography: [
    s('Portretno fotografiranje', 'Portrait session', 'Porträtshooting', 'Portretno fotografiranje', 'Servizio fotografico ritratto', 60, 90),
    s('Družinsko fotografiranje', 'Family session', 'Familienshooting', 'Obiteljsko fotografiranje', 'Servizio fotografico di famiglia', 90, 140),
  ],
  lawAndConsulting: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 'Uvodne konzultacije', 'Consulenza iniziale', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 'Beratung (1 Stunde)', 'Savjetovanje (1 sat)', 'Consulenza (1 ora)', 60, 80),
  ],
  accounting: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 'Uvodne konzultacije', 'Consulenza iniziale', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 'Beratung (1 Stunde)', 'Savjetovanje (1 sat)', 'Consulenza (1 ora)', 60, 60),
  ],
  itServices: [
    s('Uvodni posvet', 'Initial consultation', 'Erstberatung', 'Uvodne konzultacije', 'Consulenza iniziale', 30, 0),
    s('Svetovanje (1 ura)', 'Consultation (1 hour)', 'Beratung (1 Stunde)', 'Savjetovanje (1 sat)', 'Consulenza (1 ora)', 60, 60),
  ],
  educationAndTutoring: [
    s('Inštrukcije (45 min)', 'Tutoring (45 min)', 'Nachhilfe (45 Min.)', 'Instrukcije (45 min)', 'Ripetizioni (45 min)', 45, 20),
    s('Inštrukcije (90 min)', 'Tutoring (90 min)', 'Nachhilfe (90 Min.)', 'Instrukcije (90 min)', 'Ripetizioni (90 min)', 90, 38),
  ],
  carService: [
    s('Menjava pnevmatik', 'Tyre change', 'Reifenwechsel', 'Zamjena guma', 'Cambio gomme', 30, 30),
    s('Mali servis', 'Basic service', 'Kleine Inspektion', 'Mali servis', 'Tagliando base', 60, 90),
    s('Menjava olja', 'Oil change', 'Ölwechsel', 'Zamjena ulja', 'Cambio olio', 30, 50),
  ],
  cleaningAndMaintenance: [
    s('Čiščenje stanovanja', 'Apartment cleaning', 'Wohnungsreinigung', 'Čišćenje stana', 'Pulizia appartamento', 120, 60),
    s('Generalno čiščenje', 'Deep cleaning', 'Grundreinigung', 'Generalno čišćenje', 'Pulizia a fondo', 240, 140),
  ],
  other: [
    s('Posvet', 'Consultation', 'Beratung', 'Konzultacije', 'Consulenza', 30, 0),
    s('Storitev (1 ura)', 'Service (1 hour)', 'Leistung (1 Stunde)', 'Usluga (1 sat)', 'Servizio (1 ora)', 60, 40),
  ],
};

export function getServiceSuggestions(industryKey: string | null | undefined): ServiceSuggestion[] {
  if (!industryKey) return SERVICE_SUGGESTIONS.other;
  return SERVICE_SUGGESTIONS[industryKey] ?? SERVICE_SUGGESTIONS.other;
}
