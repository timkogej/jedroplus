import { createClient } from '@supabase/supabase-js';
import type {
  AllSettings,
  GeneralSettings,
  CompanySettings,
  BookingSettings,
  ChatbotSettings,
  KPISettings,
  ReminderSettings,
  LostLeadsSettings,
  ReceptionistSettings,
  defaultGeneralSettings,
  defaultCompanySettings,
  defaultBookingSettings,
  defaultChatbotSettings,
  defaultKPISettings,
  defaultReminderSettings,
  defaultLostLeadsSettings,
} from '@/types/settings';

// Settings are stored in localStorage for now
// In production, these would be stored in Supabase

const STORAGE_KEY = 'jedroplus_settings';

function getStoredSettings(): Partial<AllSettings> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveToStorage(settings: Partial<AllSettings>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getStoredSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// Fetch all settings
export async function fetchAllSettings(companyId: string): Promise<{
  data: AllSettings | null;
  error: Error | null;
}> {
  try {
    const stored = getStoredSettings();

    // Import defaults dynamically to avoid circular deps
    const {
      defaultGeneralSettings,
      defaultCompanySettings,
      defaultBookingSettings,
      defaultChatbotSettings,
      defaultKPISettings,
      defaultReminderSettings,
      defaultLostLeadsSettings,
      defaultReceptionistSettings,
    } = await import('@/types/settings');

    const settings: AllSettings = {
      general: { ...defaultGeneralSettings, ...stored.general },
      company: { ...defaultCompanySettings, ...stored.company },
      booking: { ...defaultBookingSettings, ...stored.booking },
      chatbot: { ...defaultChatbotSettings, ...stored.chatbot },
      kpi: { ...defaultKPISettings, ...stored.kpi },
      reminders: { ...defaultReminderSettings, ...stored.reminders },
      lostLeads: { ...defaultLostLeadsSettings, ...stored.lostLeads },
      receptionist: { ...defaultReceptionistSettings, ...stored.receptionist },
    };

    return { data: settings, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch settings'),
    };
  }
}

// Save general settings
export async function saveGeneralSettings(
  companyId: string,
  settings: GeneralSettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ general: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Save company settings
export async function saveCompanySettings(
  companyId: string,
  settings: CompanySettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ company: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Save booking settings
export async function saveBookingSettings(
  companyId: string,
  settings: BookingSettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ booking: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Save chatbot settings
export async function saveChatbotSettings(
  companyId: string,
  settings: ChatbotSettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ chatbot: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Save KPI settings
export async function saveKPISettings(
  companyId: string,
  settings: KPISettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ kpi: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Save reminder settings
export async function saveReminderSettings(
  companyId: string,
  settings: ReminderSettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ reminders: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Save lost leads settings
export async function saveLostLeadsSettings(
  companyId: string,
  settings: LostLeadsSettings
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ lostLeads: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Generic save for any section
export async function saveSettings<T>(
  companyId: string,
  section: keyof AllSettings,
  settings: T
): Promise<{ success: boolean; error: Error | null }> {
  try {
    saveToStorage({ [section]: settings });
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to save settings'),
    };
  }
}

// Fetch single section
export async function fetchSettingsSection<T>(
  companyId: string,
  section: keyof AllSettings
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await fetchAllSettings(companyId);
    if (result.error) throw result.error;

    const sectionData = result.data?.[section] as T | undefined;
    return { data: sectionData ?? null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch settings'),
    };
  }
}
