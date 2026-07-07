// Tilgangsstyring (arbeidsordre seksjon 6). ALL gating i appen går gjennom
// harPluss() — aldri direkte mot profiler.plan-kolonnen. Ekte betaling kobles
// senere inn på nøyaktig dette ene punktet (Fase 5).

import { createClient } from "@/lib/supabase/server";

/** Prisplassholder for paywall-skjermen (Fase 3). */
export const PLUSS_PRIS = "79 kr/mnd — avslutt når du vil";

/** Pilotmodus: alt er gratis mens NEXT_PUBLIC_PILOT er satt til "true". */
export function erPilot(): boolean {
  return process.env.NEXT_PUBLIC_PILOT === "true";
}

/**
 * Eneste inngang til tilgangsstyring. True hvis brukeren har tilgang til
 * Pluss-funksjoner. I pilotmodus er alt gratis (alltid true). Uten profilrad
 * tolkes brukeren som 'gratis'.
 */
export async function harPluss(brukerId: string): Promise<boolean> {
  if (erPilot()) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiler")
    .select("plan")
    .eq("bruker_id", brukerId)
    .maybeSingle();

  return data?.plan === "pluss";
}
