"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendKodeEpost } from "@/lib/epost";
import {
  fullforKvote,
  hmacNokkel,
  klientIp,
  kvoteMelding,
  reserverInnlogging,
  type RpcKlient,
} from "@/lib/kvote";
import { logg } from "@/lib/logg";

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
  const db = admin as unknown as RpcKlient;

  // Grense per e-postadresse og en romslig grense per nettverk (A4). Bare en
  // HMAC av e-post og IP lagres. Kan grensen ikke sjekkes, slippes
  // forespørselen gjennom: innlogging skal ikke stoppe fordi kvotetabellen er
  // utilgjengelig, og Supabase har egne grenser i tillegg.
  const hemmelighet = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const hode = await headers();
  const ip = klientIp((n) => hode.get(n));
  const kvote = await reserverInnlogging(
    db,
    hmacNokkel("epost", e, hemmelighet),
    ip ? hmacNokkel("ip", ip, hemmelighet) : null,
  );
  if (!kvote.ok && kvote.grunn !== "feil") {
    logg("warn", "logg-inn", "kodegrense", { grunn: kvote.grunn, handling: kvote.handling });
    return { ok: false, feil: kvoteMelding(kvote) };
  }
  if (!kvote.ok) logg("error", "logg-inn", "kvote_utilgjengelig");
  // En kode som ikke ble sendt, teller ikke.
  const avslutt = async (sendt: boolean) => {
    if (kvote.ok) await fullforKvote(db, kvote.gruppe, sendt, sendt ? {} : { feil: "ingen_svar" });
  };

  // Generer engangskode (email_otp). For nye brukere må kontoen finnes først.
  let gen = await admin.auth.admin.generateLink({ type: "magiclink", email: e });
  if (gen.error) {
    await admin.auth.admin.createUser({ email: e, email_confirm: true });
    gen = await admin.auth.admin.generateLink({ type: "magiclink", email: e });
  }
  const kode = gen.data?.properties?.email_otp;
  if (gen.error || !kode) {
    await avslutt(false);
    return { ok: false, feil: "Kunne ikke lage kode. Prøv igjen." };
  }

  const sendt = await sendKodeEpost(e, kode);
  await avslutt(sendt);
  if (!sendt) {
    return { ok: false, feil: "Kunne ikke sende e-post. Prøv igjen." };
  }

  return { ok: true, lengde: kode.length };
}
