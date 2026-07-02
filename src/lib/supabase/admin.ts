import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-klient med service-role-nøkkelen. Går UTENOM row-level security og
 * kan lese/skrive på tvers av alle brukere. Brukes kun server-side i den
 * daglige cron-jobben, som kjører uten en innlogget bruker (auth.uid() finnes
 * ikke der, så de vanlige RLS-klientene ville ikke sett noen frister).
 *
 * MÅ ALDRI importeres i Client Components eller sendes til nettleseren.
 * SUPABASE_SERVICE_ROLE_KEY er hemmelig og skal kun ligge i miljøvariabler.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
