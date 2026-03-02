// lib/validations/webhook.ts
// Zod sheme za validacijo webhook payloadov

import { z } from "zod";

// ============================================================================
// OSNOVNE SHEME
// ============================================================================

const companyIdSchema = z.string().min(1, "Company ID je obvezen").max(100);
const actorSchema = z.string().max(200).default("unknown");
const timestampSchema = z.string().optional();

const metaSchema = z
  .object({
    app: z.string().default("Integrate"),
    version: z.string().default("1.0"),
  })
  .optional();

// ============================================================================
// WEBHOOK PAYLOAD SHEMA
// ============================================================================

// Dovoli katerikoli string - tvoj webhookValidator.ts že preverja logiko
const eventSchema = z.string().min(1, "Event je obvezen");
const entitySchema = z.string().min(1, "Entity je obvezen");

export const webhookPayloadSchema = z.object({
  event: eventSchema,
  entity: entitySchema,
  data: z.record(z.string(), z.unknown()),
  company_id: companyIdSchema,
  actor: actorSchema,
  timestamp: timestampSchema,
  meta: metaSchema,
});

// ============================================================================
// HELPER FUNKCIJE
// ============================================================================

export function validateWebhookPayload(payload: unknown): {
  success: boolean;
  data?: z.infer<typeof webhookPayloadSchema>;
  errors?: string[];
} {
  const result = webhookPayloadSchema.safeParse(payload);

  if (!result.success) {
    const errors: string[] = [];
    for (const issue of result.error.issues) {
      errors.push(issue.path.join(".") + ": " + issue.message);
    }
    return { success: false, errors: errors };
  }

  return { success: true, data: result.data };
}

// Validira entity data - dovoli vse ker imaš svoj webhookValidator
export function validateEntityData(
  entity: string,
  data: unknown
): { success: boolean; data?: unknown; errors?: string[] } {
  // Tvoj webhookValidator.ts že preverja strukturo podatkov
  // Tukaj samo preverimo da je data objekt
  if (typeof data !== "object" || data === null) {
    return { success: false, errors: ["Data mora biti objekt"] };
  }
  return { success: true, data: data };
}

// Sanitizira string - odstrani potencialno nevarne znake
export function sanitizeString(input: string): string {
  let result = input;
  // Odstrani HTML tage
  result = result.replace(/<[^>]*>/g, "");
  // Odstrani nevarne znake
  result = result.split("<").join("");
  result = result.split(">").join("");
  result = result.split(";").join("");
  return result.trim();
}

// Sanitizira celoten objekt
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }

  return sanitized as T;
}