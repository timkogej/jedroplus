import { supabase } from '@/lib/supabaseClient';

/**
 * Generates sequential unique IDs that never repeat across any company
 * Format: Timestamp-based with random suffix to ensure uniqueness
 * Example: 1704050400000-1234567
 */
export async function generateSequentialAppointmentId(): Promise<string> {
  // Use timestamp (milliseconds since epoch) + random 7-digit number
  const timestamp = Date.now();
  const random = Math.floor(1000000 + Math.random() * 9000000); // 7 digits

  // Create unique ID: timestamp-random
  const uniqueId = `${timestamp}-${random}`;

  // Verify it doesn't exist (extremely unlikely but safe)
  const { data } = await supabase
    .from('Termini')
    .select('id')
    .eq('id', uniqueId)
    .single();

  // If by some miracle it exists, recursively generate new one
  if (data) {
    return generateSequentialAppointmentId();
  }

  return uniqueId;
}

/**
 * Alternative: Pure sequential counter using database function
 * Requires the increment_appointment_counter function to be created in Supabase
 *
 * SQL to create:
 *
 * -- Create counter table
 * CREATE TABLE IF NOT EXISTS appointment_id_counter (
 *   id INTEGER PRIMARY KEY DEFAULT 1,
 *   current_value BIGINT NOT NULL DEFAULT 0
 * );
 *
 * -- Insert initial value
 * INSERT INTO appointment_id_counter (id, current_value)
 * VALUES (1, 0)
 * ON CONFLICT (id) DO NOTHING;
 *
 * -- Function to increment and return counter
 * CREATE OR REPLACE FUNCTION increment_appointment_counter()
 * RETURNS BIGINT AS $$
 * DECLARE
 *   new_value BIGINT;
 * BEGIN
 *   UPDATE appointment_id_counter
 *   SET current_value = current_value + 1
 *   WHERE id = 1
 *   RETURNING current_value INTO new_value;
 *
 *   RETURN new_value;
 * END;
 * $$ LANGUAGE plpgsql;
 */
export async function generateSequentialIdFromCounter(): Promise<string> {
  try {
    // Get and increment global counter
    const { data, error } = await supabase.rpc('increment_appointment_counter');

    if (error) {
      console.error('Error getting sequential ID from counter:', error);
      // Fallback to timestamp-based
      return generateSequentialAppointmentId();
    }

    // Return padded counter (e.g., 0000000001, 0000000002, etc.)
    return String(data).padStart(10, '0');
  } catch (err) {
    console.error('Error in generateSequentialIdFromCounter:', err);
    // Fallback to timestamp-based
    return generateSequentialAppointmentId();
  }
}

/**
 * Simple sync version for generating IDs without database check
 * Use when you need an ID immediately and can handle potential (unlikely) collisions
 */
export function generateUniqueAppointmentId(): string {
  const timestamp = Date.now();
  const random = Math.floor(1000000 + Math.random() * 9000000);
  return `${timestamp}-${random}`;
}
