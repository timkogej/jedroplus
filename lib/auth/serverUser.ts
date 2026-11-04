import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

// The signed-in user for this request, read from the session token. With the
// project's asymmetric signing keys getClaims() checks the token locally
// instead of asking Supabase each time (~250 ms); with an old token it falls
// back to asking Supabase. Wrapped in cache() so the page and its data loader
// share one check.
export const getServerUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (error || !id) return null;
  return { id };
});
