export type MemberRole = 'owner' | 'admin' | 'staff';

export interface StaffPermissions {
  id?: string;
  company_id: string;
  // Termini
  can_view_all_appointments: boolean;
  can_view_only_own_appointments: boolean;
  can_edit_all_appointments: boolean;
  can_edit_only_own_appointments: boolean;
  can_create_appointments: boolean;
  can_delete_appointments: boolean;
  // Stranke
  can_view_clients: boolean;
  can_edit_clients: boolean;
  can_create_clients: boolean;
  can_delete_clients: boolean;
  // Storitve
  can_view_services: boolean;
  can_edit_services: boolean;
  can_create_services: boolean;
  can_delete_services: boolean;
  // Osebje
  can_view_staff: boolean;
  can_edit_staff: boolean;
  // Analitika
  can_view_analytics: boolean;
  // Moduli
  can_access_asistent_plus: boolean;
  can_access_komunikacija: boolean;
  can_access_chatbot_plus: boolean;
  can_manage_chatbot_plus_settings: boolean;
  can_access_opomniki: boolean;
  can_manage_opomniki: boolean;
  can_access_rezervacije: boolean;
  can_manage_rezervacije: boolean;
  can_access_lost_leads: boolean;
  can_manage_lost_leads: boolean;
}
