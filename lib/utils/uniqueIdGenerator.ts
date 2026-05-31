import { supabase } from '@/lib/supabaseClient';

/**
 * Generates a unique 8-digit ID for appointments
 * Format: 10000000 - 99999999 (always 8 digits)
 * Uses database check to ensure uniqueness
 */
export async function generateUnique8DigitId(
  tableName: string = 'Termini',
  columnName: string = 'id'
): Promise<string> {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random 8-digit number
    const min = 10000000; // Minimum 8-digit number
    const max = 99999999; // Maximum 8-digit number
    const randomId = Math.floor(Math.random() * (max - min + 1)) + min;
    const idString = randomId.toString();

    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq(columnName, idString);

    if (!count || count === 0) {
      return idString;
    }

    // If data found, try again
    console.log(`ID ${idString} already exists, generating new one... (attempt ${attempt + 1})`);
  }

  // Fallback: use timestamp-based 8 digits if all random attempts fail
  const timestamp = Date.now();
  const last8Digits = timestamp.toString().slice(-8);

  // Pad with leading zeros if needed
  console.log(`Fallback: using timestamp-based ID: ${last8Digits.padStart(8, '0')}`);
  return last8Digits.padStart(8, '0');
}

/**
 * Synchronous version - generates 8-digit ID without database check
 * Use when you need an ID immediately and can handle potential collisions
 */
export function generateSimple8DigitId(): string {
  const min = 10000000;
  const max = 99999999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}
