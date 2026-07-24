import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth-tilbakekall (PKCE code flow) — Google-innlogging via Supabase.
 * Bytter `code` mot en session, beriker navnet (brevnavn) fra Google (uten å
 * overskrive et eksisterende), setter user_metadata.har_sett_onboarding hvis det mangler
 * (Onboarding/Logg inn-arbeidsordre §1.5 — «Kom i gang» vises aldri igjen for
 * en kjent bruker, uansett enhet), og sender brukeren videre til `next`.
 * Feiler pent til /logg-inn?feil=google — aldri en hvit skjerm (også når
 * Google-provideren ikke er satt opp i Supabase ennå).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Kun relative mål tillates (unngå åpen redirect).
  const nesteParam = searchParams.get("next");
  const next = nesteParam && nesteParam.startsWith("/") ? nesteParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Navn-berikelse: Google gir full_name/name (og given_name som siste
      // utvei). Sett brevnavn kun når det er tomt — aldri overskriv. Feil her
      // skal ikke stoppe innlogging.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const meta = user?.user_metadata ?? {};
        const eksisterende =
          (meta.brevnavn as string | undefined)?.trim() ||
          (meta.fornavn as string | undefined)?.trim();
        const fraGoogle = (
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          (meta.given_name as string | undefined)
        )?.trim();
        const nyeFelter: Record<string, unknown> = {};
        if (!eksisterende && fraGoogle) nyeFelter.brevnavn = fraGoogle;
        if (!meta.har_sett_onboarding) nyeFelter.har_sett_onboarding = true;
        if (user && Object.keys(nyeFelter).length > 0) {
          await supabase.auth.updateUser({ data: nyeFelter });
        }
      } catch (feil) {
        console.error("Google fornavn/onboarding-berikelse feilet", feil);
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/logg-inn?feil=google", request.url));
}
