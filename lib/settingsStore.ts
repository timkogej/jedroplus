import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";

export async function loadCompanyRow(companyId: string) {
  return supabaseReadOnly
    .from("Podatki podjetij")
    .select("*")
    .eq("ID Podjetja", companyId)
    .maybeSingle();
}

export async function updateCompanyRow(
  companyId: string,
  patch: Record<string, unknown>
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function tableExists(tableName: string) {
  const { error } = await supabaseReadOnly
    .from(tableName)
    .select("*")
    .limit(1);
  if (!error) return true;
  if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
    return false;
  }
  return true;
}

export function buildCompanyPayload(companyRow?: Record<string, unknown> | null) {
  if (!companyRow) return undefined;
  return {
    display_name: companyRow["Naziv Podjetja"] ?? companyRow["display_name"],
    email: companyRow.from_email ?? companyRow.email,
    phone: companyRow.phone ?? companyRow.telefon,
    tax_number: companyRow.tax_number ?? companyRow["Davčna številka"],
    industry: companyRow.Panoga ?? companyRow.industry,
  };
}
