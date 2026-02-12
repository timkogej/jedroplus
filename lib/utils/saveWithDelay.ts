/**
 * Utility function to add a delay after save operations
 * This ensures data has time to propagate through the system
 *
 * @param saveOperation - The async save operation to execute
 * @param delayMs - Delay in milliseconds (default: 1000ms)
 * @returns The result of the save operation
 */
export async function saveWithDelay<T>(
  saveOperation: () => Promise<T>,
  delayMs: number = 1000
): Promise<T> {
  // Execute save operation
  const result = await saveOperation();

  // Wait for system to process
  await new Promise(resolve => setTimeout(resolve, delayMs));

  return result;
}

/**
 * Simple delay function
 * @param ms - Delay in milliseconds
 */
export function delay(ms: number = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
