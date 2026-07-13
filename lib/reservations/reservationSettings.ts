// lib/reservations/reservationSettings.ts
//
// Shared (server + client) shape, defaults, and pure parser for the Rezervacije
// page's settings. The single "Podatki podjetij" row is mapped into a
// ready-to-render ReservationSettings object here so BOTH the server loader
// (fetchReservationSettings.server.ts) and the client fallback path
// (RezervacijeClient's own fetchSettings) produce byte-identical output.
//
// No "server-only" import here on purpose: the client shell needs the type and
// the defaults, so this module must stay importable from the browser bundle.

export interface ReservationSettings {
  timeSlotLength: number;
  sendClientConfirmation: boolean;
  clientConfirmationChannel: string;
  sendOnlineConfirmation: boolean;
  onlineConfirmationChannel: string;
  primaryColor: string;
  secondaryColor: string;
  bgFromColor: string;
  bgToColor: string;
  bookingOmogocen: boolean;
  bookingLink1: string;
  bookingLink2: string;
  bookingLink3: string;
  bookingLink4: string;
  bookingLink5: string;
  bookingLink6: string;
  apptManagementLink: string;
  mainBookingLink: string;
}

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  timeSlotLength: 30,
  sendClientConfirmation: false,
  clientConfirmationChannel: "email",
  sendOnlineConfirmation: false,
  onlineConfirmationChannel: "email",
  primaryColor: "#8B5CF6",
  secondaryColor: "#06B6D4",
  bgFromColor: "#8B5CF6",
  bgToColor: "#06B6D4",
  bookingOmogocen: true,
  bookingLink1: "",
  bookingLink2: "",
  bookingLink3: "",
  bookingLink4: "",
  bookingLink5: "",
  bookingLink6: "",
  apptManagementLink: "",
  mainBookingLink: "",
};

type Row = Record<string, unknown> | null | undefined;

// Maps a raw "Podatki podjetij" row into ReservationSettings. Mirrors the
// original inline mapping from the Rezervacije page exactly (same column
// fallbacks, same truthiness rules), so server-seeded and client-fetched
// results are identical.
export function parseReservationSettings(podatkiRow: Row): ReservationSettings {
  const timeSlotValue = podatkiRow?.["koledar_ure"] || podatkiRow?.["Koledar_ure"] || 30;

  const potrdiloPodatkiRaw =
    podatkiRow?.["Potrdilo po rezervaciji"] ?? podatkiRow?.["Potrdilo ob rezervaciji"];
  const sendConfirmation =
    potrdiloPodatkiRaw === true ||
    potrdiloPodatkiRaw === "true" ||
    potrdiloPodatkiRaw === "yes" ||
    potrdiloPodatkiRaw === "da";
  const clientConfirmationChannel = (podatkiRow?.["potrdilo_channel"] || "email") as string;

  const potrdiloPodatkiOnlineRaw =
    podatkiRow?.["Potrdilo online termina"] ?? podatkiRow?.["Potrdilo online rez"];
  const sendOnlineConfirmation =
    potrdiloPodatkiOnlineRaw === true ||
    potrdiloPodatkiOnlineRaw === "true" ||
    potrdiloPodatkiOnlineRaw === "yes" ||
    potrdiloPodatkiOnlineRaw === "da";
  const onlineConfirmationChannel = (podatkiRow?.["potrdilo_online_channel"] || "email") as string;

  const primaryColor = (podatkiRow?.["Booking_primary"] || podatkiRow?.["booking_primary"] || "#8B5CF6") as string;
  const secondaryColor = (podatkiRow?.["Booking_secondary"] || podatkiRow?.["booking_secondary"] || "#06B6D4") as string;
  const bgFromColor = (podatkiRow?.["booking_bg_from"] || podatkiRow?.["Booking_bg_from"] || primaryColor) as string;
  const bgToColor = (podatkiRow?.["booking_bg_to"] || podatkiRow?.["Booking_bg_to"] || secondaryColor) as string;

  const bookingEnabled = podatkiRow?.["booking_omogocen"];

  return {
    timeSlotLength: typeof timeSlotValue === "number" ? timeSlotValue : parseInt(String(timeSlotValue), 10) || 30,
    sendClientConfirmation: sendConfirmation,
    clientConfirmationChannel,
    sendOnlineConfirmation,
    onlineConfirmationChannel,
    primaryColor,
    secondaryColor,
    bgFromColor,
    bgToColor,
    bookingOmogocen: bookingEnabled !== false && bookingEnabled !== "false",
    bookingLink1: String(podatkiRow?.["booking_link_1"] ?? podatkiRow?.["Booking_link_1"] ?? ""),
    bookingLink2: String(podatkiRow?.["booking_link_2"] ?? podatkiRow?.["Booking_link_2"] ?? ""),
    bookingLink3: String(podatkiRow?.["booking_link_3"] ?? podatkiRow?.["Booking_link_3"] ?? ""),
    bookingLink4: String(podatkiRow?.["booking_link_4"] ?? podatkiRow?.["Booking_link_4"] ?? ""),
    bookingLink5: String(podatkiRow?.["booking_link_5"] ?? podatkiRow?.["Booking_link_5"] ?? ""),
    bookingLink6: String(podatkiRow?.["booking_link_6"] ?? podatkiRow?.["Booking_link_6"] ?? ""),
    apptManagementLink: String(podatkiRow?.["appt_management_link"] ?? ""),
    mainBookingLink: String(podatkiRow?.["main_booking_link"] ?? ""),
  };
}
