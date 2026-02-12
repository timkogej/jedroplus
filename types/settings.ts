// TypeScript types for settings

// General Settings
export interface GeneralSettings {
  userName: string;
  email: string;
  phone: string;
  language: 'sl' | 'en' | 'de';
  timezone: string;
  dateFormat: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  theme: 'light' | 'dark' | 'auto';
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundNotifications: boolean;
}

// Company Settings - Interval-based working hours
export interface TimeInterval {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface WorkingHoursDay {
  enabled: boolean;
  intervals: TimeInterval[];
}

// Legacy single-interval format (for backward compatibility)
export interface WorkingHours {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;
}

export interface CompanySettings {
  companyName: string;
  industry: string; // Panoga
  taxNumber: string;
  registrationNumber: string;
  address: string;
  zipCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  workingHours: Record<string, WorkingHoursDay>;
}

// Booking/Rezervacije Settings
export interface BookingSettings {
  timeSlotDuration: 30 | 60; // minutes - only 30 or 60 allowed
  autoConfirm: boolean;
  allowCancellation: boolean;
  cancellationDeadline: number; // hours
  sendConfirmationEmail: boolean;
  sendReminderEmail: boolean;
  reminderTiming: number; // hours before
  // Booking page branding
  bookingUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundStartColor: string;
  backgroundEndColor: string;
}

// Chatbot Settings - Updated for Chatbot+
export interface AutoResponse {
  id: string;
  trigger: string;
  response: string;
  enabled: boolean;
}

export interface ChatbotDesign {
  bgGradientFrom: string;
  bgGradientTo: string;
  userBubbleGradientFrom: string;
  userBubbleGradientTo: string;
  userMsgGradientFrom: string; // User message TEXT color gradient
  userMsgGradientTo: string;
  botBubbleGradientFrom: string;
  botBubbleGradientTo: string;
  accentGradientFrom: string;
  accentGradientTo: string;
  textColor: string;
  fontFamily: string;
  borderRadius: number;
}

export interface ChatbotSettings {
  enabled: boolean;
  language: 'sl' | 'en' | 'it' | 'de';
  name: string;
  tone: string; // Free text instead of enum
  welcomeMessage: string;
  instructions: string; // New field for chatbot instructions
  chatbotLink: string; // Locked chatbot link
  canBook: boolean;
  canCancel: boolean;
  showServices: boolean;
  showHours: boolean;
  autoResponses: AutoResponse[];
  design: ChatbotDesign;
}

// KPI Settings (keeping for backward compatibility, but removed from UI)
export interface KPISettings {
  monthlyAppointmentGoal: number;
  monthlyRevenueGoal: number;
  newClientsGoal: number;
  trackOccupancy: boolean;
  trackRevenue: boolean;
  trackSatisfaction: boolean;
  weeklyReport: boolean;
  reportDay: 'monday' | 'friday' | 'sunday';
  monthlyReport: boolean;
}

// Reminder Settings - Updated
export interface ReminderSettings {
  enabled: boolean;
  sendingLanguage: 'sl' | 'en' | 'it' | 'de'; // New field
  communicationTone: 'professional' | 'friendly' | 'casual' | 'formal';
  replyToEmail: string;
  emailReminders: boolean;
  smsReminders: boolean;
  // Before appointment
  sendBeforeReminder: boolean;
  beforeReminderTime: number; // hours before
  beforeReminderInstructions: string;
  // After appointment
  sendAfterReminder: boolean;
  afterReminderTime: number; // hours after
  afterReminderInstructions: string;
  // Discount
  sendDiscount: boolean;
  discountAmount: string;
}

// Lost Leads Settings - Updated
export interface LostLeadsSettings {
  enabled: boolean;
  inactivityPeriod: number; // days
  communicationInstructions: string;
  offerDiscount: boolean;
  discountDescription: string;
}

// Receptionist+ Settings - New
export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface ReceptionistSettings {
  phoneNumber: string; // Locked
  greetingText: string;
  handoffNumber: string;
  knowledgeBase: KnowledgeChunk[];
}

// All Settings combined
export interface AllSettings {
  general: GeneralSettings;
  company: CompanySettings;
  booking: BookingSettings;
  chatbot: ChatbotSettings;
  kpi: KPISettings;
  reminders: ReminderSettings;
  lostLeads: LostLeadsSettings;
  receptionist: ReceptionistSettings;
}

// Settings section type for navigation - Updated
export type SettingsSection =
  | 'splosno'
  | 'podjetje'
  | 'rezervacije'
  | 'chatbot'
  | 'opomniki'
  | 'lost-leads'
  | 'receptionist';

// Default values
export const defaultGeneralSettings: GeneralSettings = {
  userName: '',
  email: '',
  phone: '',
  language: 'sl',
  timezone: 'Europe/Ljubljana',
  dateFormat: 'DD.MM.YYYY',
  theme: 'light',
  emailNotifications: true,
  pushNotifications: false,
  soundNotifications: false,
};

export const defaultWorkingHoursDay: Record<string, WorkingHoursDay> = {
  Ponedeljek: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
  Torek: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
  Sreda: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
  Četrtek: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
  Petek: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
  Sobota: { enabled: false, intervals: [{ start: '09:00', end: '13:00' }] },
  Nedelja: { enabled: false, intervals: [{ start: '09:00', end: '13:00' }] },
};

// Legacy format for backward compatibility
export const defaultWorkingHours: Record<string, WorkingHours> = {
  Ponedeljek: { enabled: true, start: '08:00', end: '17:00' },
  Torek: { enabled: true, start: '08:00', end: '17:00' },
  Sreda: { enabled: true, start: '08:00', end: '17:00' },
  Četrtek: { enabled: true, start: '08:00', end: '17:00' },
  Petek: { enabled: true, start: '08:00', end: '17:00' },
  Sobota: { enabled: false, start: '09:00', end: '13:00' },
  Nedelja: { enabled: false, start: '09:00', end: '13:00' },
};

export const defaultCompanySettings: CompanySettings = {
  companyName: '',
  industry: '',
  taxNumber: '',
  registrationNumber: '',
  address: '',
  zipCode: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  workingHours: defaultWorkingHoursDay,
};

export const defaultBookingSettings: BookingSettings = {
  timeSlotDuration: 30,
  autoConfirm: false,
  allowCancellation: true,
  cancellationDeadline: 24,
  sendConfirmationEmail: true,
  sendReminderEmail: true,
  reminderTiming: 24,
  bookingUrl: '',
  primaryColor: '#A855F7',
  secondaryColor: '#EC4899',
  backgroundStartColor: '#F9FAFB',
  backgroundEndColor: '#FFFFFF',
};

export const defaultChatbotDesign: ChatbotDesign = {
  bgGradientFrom: '#F5F3FF',
  bgGradientTo: '#E0F2FE',
  userBubbleGradientFrom: '#7C75FC',
  userBubbleGradientTo: '#50C3D2',
  userMsgGradientFrom: '#FFFFFF', // Default white text for user messages
  userMsgGradientTo: '#F0F0FF',
  botBubbleGradientFrom: '#FFFFFF',
  botBubbleGradientTo: '#F9FAFB',
  accentGradientFrom: '#7C75FC',
  accentGradientTo: '#44D0C6',
  textColor: '#1F2937',
  fontFamily: 'Inter',
  borderRadius: 12,
};

export const defaultChatbotSettings: ChatbotSettings = {
  enabled: true,
  language: 'sl',
  name: 'Ana',
  tone: 'prijazen',
  welcomeMessage: 'Pozdravljeni! Kako vam lahko pomagam danes?',
  instructions: '',
  chatbotLink: '',
  canBook: true,
  canCancel: true,
  showServices: true,
  showHours: true,
  autoResponses: [],
  design: defaultChatbotDesign,
};

export const defaultKPISettings: KPISettings = {
  monthlyAppointmentGoal: 100,
  monthlyRevenueGoal: 5000,
  newClientsGoal: 10,
  trackOccupancy: true,
  trackRevenue: true,
  trackSatisfaction: false,
  weeklyReport: true,
  reportDay: 'monday',
  monthlyReport: true,
};

export const defaultReminderSettings: ReminderSettings = {
  enabled: true,
  sendingLanguage: 'sl',
  communicationTone: 'friendly',
  replyToEmail: '',
  emailReminders: true,
  smsReminders: false,
  sendBeforeReminder: true,
  beforeReminderTime: 24,
  beforeReminderInstructions: '',
  sendAfterReminder: false,
  afterReminderTime: 24,
  afterReminderInstructions: '',
  sendDiscount: false,
  discountAmount: '',
};

export const defaultLostLeadsSettings: LostLeadsSettings = {
  enabled: false,
  inactivityPeriod: 60,
  communicationInstructions: '',
  offerDiscount: false,
  discountDescription: '',
};

export const defaultReceptionistSettings: ReceptionistSettings = {
  phoneNumber: '',
  greetingText: '',
  handoffNumber: '',
  knowledgeBase: [],
};
