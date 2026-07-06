"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendKodeEpost } from "@/lib/epost";

export type KodeResultat =
  | { ok: true; lengde: number }
  | { ok: false; feil: string };

/**
 * Ber om en engangskode. Vi genererer koden via admin-API-et og sender den
 * selv med Resend — uavhengig av Supabase sin innebygde e-post. Ny e-post
 * oppretter en konto (email_confirm: true), som `signInWithOtp` ellers gjør.
 */
export async function beOmKode(epost: string): Promise<KodeResultat> {
  const e = epost.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return { ok: false, feil: "Sjekk e-postadressen og prøv igjen." };
  }

  const admin = createAdminClient();

  // Generer engangskode (email_otp). For nye brukere må kontoen finnes først.
  let gen = await admin.auth.admin.generateLink({ type: "magiclink", email: e });
  if (gen.error) {
    await admin.auth.admin.createUser({ email: e, email_confirm: true });
    gen = await admin.auth.admin.generateLink({ type: "magiclink", email: e });
  }
  const kode = gen.data?.properties?.email_otp;
  if (gen.error || !kode) {
    return { ok: false, feil: "Kunne ikke lage kode. Prøv igjen." };
  }

  const sendt = await sendKodeEpost(e, kode);
  if (!sendt) {
    return { ok: false, feil: "Kunne ikke sende e-post. Prøv igjen." };
  }

  return { ok: true, lengde: kode.length };
}
