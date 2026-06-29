import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient for bruk i Client Components (kjører i nettleseren).
 * Bruker kun den offentlige anon-nøkkelen — aldri service-nøkler her.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
