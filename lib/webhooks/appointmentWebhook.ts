import { supabase } from '@/lib/supabaseClient';
import { WEBHOOK_URL } from '@/lib/webhook';

interface ClientData {
  id: string;
  ime: string;
  priimek: string;
  email: string | null;
  telefon: string | null;
  spol: string | null;
  barva: string | null;
}

interface ServiceData {
  id: string;
  naziv: string;
  barva: string | null;
  trajanje: number;
  skupni_cas: number | null;
  cena: number | null;
}

interface EmployeeData {
  id: string;
  ime: string;
  priimek: string;
  email: string;
  pozicija: string | null;
  barva: string | null;
}

interface AppointmentData {
  id?: string;
  datum: string;
  cas_zacetek: string;
  cas_konec: string;
  status: string;
  opombe: string | null;
  stranka_id?: string;
  storitev_id?: string;
  zaposleni_id?: string;
}

interface EnhancedWebhookPayload {
  event: 'APPOINTMENT_CREATED' | 'APPOINTMENT_UPDATED' | 'APPOINTMENT_DELETED';
  entity: 'appointment';
  company_id: string;
  actor: string;
  timestamp: string;
  data: {
    appointment: {
      unique_id: string;
      datum: string;
      cas_zacetek: string;
      cas_konec: string;
      trajanje_minut: number;
      status: string;
      opombe: string | null;
    };
    stranka: {
      id_vrstice: string;
      id: string;
      ime: string;
      priimek: string;
      polno_ime: string;
      email: string | null;
      telefon: string | null;
      spol: string | null;
      barva: string | null;
    } | null;
    storitev: {
      id: string;
      naziv: string;
      barva: string | null;
      trajanje: number;
      skupni_cas: number | null;
      cena: number | null;
    } | null;
    zaposleni: {
      id: string;
      ime: string;
      priimek: string;
      polno_ime: string;
      email: string;
      pozicija: string | null;
      inicialke: string;
      barva: string | null;
    } | null;
  };
}

/**
 * Calculate duration in minutes from start and end times
 */
function calculateDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  try {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    return Math.max(0, endTotalMin - startTotalMin);
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
}

/**
 * Get employee initials from name
 */
function getInitials(ime: string, priimek: string): string {
  const first = ime?.charAt(0)?.toUpperCase() || '';
  const last = priimek?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}`;
}

/**
 * Send enhanced appointment webhook with complete client, service, and employee data
 * Includes client gender (Spol) and row ID as requested
 */
export async function sendEnhancedAppointmentWebhook(
  appointmentId: string,
  appointmentData: AppointmentData,
  companyId: string,
  actor: string,
  event: 'APPOINTMENT_CREATED' | 'APPOINTMENT_UPDATED' | 'APPOINTMENT_DELETED' = 'APPOINTMENT_CREATED'
): Promise<void> {
  try {
    // Fetch COMPLETE client data including gender and color
    let clientData: ClientData | null = null;
    if (appointmentData.stranka_id) {
      const { data: client } = await supabase
        .from('Stranke')
        .select('id, ime, priimek, email, "Telefonska številka", Spol, Barva')
        .eq('id', appointmentData.stranka_id)
        .single();

      if (client) {
        clientData = {
          id: client.id,
          ime: client.ime || '',
          priimek: client.priimek || '',
          email: client.email || null,
          telefon: client['Telefonska številka'] || null,
          spol: client.Spol || null,
          barva: client.Barva || null,
        };
      }
    }

    // Fetch service data
    let serviceData: ServiceData | null = null;
    if (appointmentData.storitev_id) {
      const { data: service } = await supabase
        .from('Storitve')
        .select('id, naziv, barva, "Skupno trajanje", skupni_cas, cena')
        .eq('id', appointmentData.storitev_id)
        .single();

      if (service) {
        serviceData = {
          id: service.id,
          naziv: service.naziv || '',
          barva: service.barva || null,
          trajanje: service['Skupno trajanje'] || 60,
          skupni_cas: service.skupni_cas || service['Skupno trajanje'] || 60,
          cena: service.cena || null,
        };
      }
    }

    // Fetch employee data
    let employeeData: EmployeeData | null = null;
    if (appointmentData.zaposleni_id) {
      const { data: employee } = await supabase
        .from('Osebe')
        .select('id, ime, priimek, email, pozicija, Barva')
        .eq('id', appointmentData.zaposleni_id)
        .single();

      if (employee) {
        employeeData = {
          id: employee.id,
          ime: employee.ime || '',
          priimek: employee.priimek || '',
          email: employee.email || '',
          pozicija: employee.pozicija || null,
          barva: employee.Barva || null,
        };
      }
    }

    // Calculate duration
    const durationMinutes = calculateDuration(
      appointmentData.cas_zacetek,
      appointmentData.cas_konec
    );

    // Create comprehensive payload
    const webhookPayload: EnhancedWebhookPayload = {
      event,
      entity: 'appointment',
      company_id: companyId,
      actor: actor || 'unknown',
      timestamp: new Date().toISOString(),
      data: {
        appointment: {
          unique_id: appointmentId,
          datum: appointmentData.datum,
          cas_zacetek: appointmentData.cas_zacetek,
          cas_konec: appointmentData.cas_konec,
          trajanje_minut: durationMinutes,
          status: appointmentData.status,
          opombe: appointmentData.opombe || null,
        },

        // COMPLETE CLIENT DATA with gender and row ID
        stranka: clientData
          ? {
              id_vrstice: clientData.id,
              id: clientData.id,
              ime: clientData.ime,
              priimek: clientData.priimek,
              polno_ime: `${clientData.ime} ${clientData.priimek}`.trim(),
              email: clientData.email,
              telefon: clientData.telefon,
              spol: clientData.spol,
              barva: clientData.barva,
            }
          : null,

        // SERVICE DATA
        storitev: serviceData,

        // EMPLOYEE DATA with initials
        zaposleni: employeeData
          ? {
              id: employeeData.id,
              ime: employeeData.ime,
              priimek: employeeData.priimek,
              polno_ime: `${employeeData.ime} ${employeeData.priimek}`.trim(),
              email: employeeData.email,
              pozicija: employeeData.pozicija,
              inicialke: getInitials(employeeData.ime, employeeData.priimek),
              barva: employeeData.barva,
            }
          : null,
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[enhanced-webhook] Sending payload:', JSON.stringify(webhookPayload, null, 2));
    }

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    console.log('[enhanced-webhook] Sent successfully for appointment:', appointmentId);
  } catch (error) {
    console.error('[enhanced-webhook] Error sending webhook:', error);
    // Don't throw - webhook failure shouldn't prevent save
  }
}
