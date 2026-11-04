import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

// The signed-in user for this request. Wrapped in React's cache() so the page
// and its data loader share one auth round trip instead of each asking
// Supabase separately (~250 ms each).
export const getServerUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
