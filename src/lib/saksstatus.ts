// Endringer av sak og frist på serveren. Klienten sendes inn, så eierskap og
// regler kan testes uten Next. Hver funksjon sjekker eierskap selv, i tillegg til
// RLS: en rad som ikke tilhører brukeren gir en feilmelding, ikke en stille null.
import type { SupabaseClient } from "@supabase/supabase-js";
import { SAK_UTFALL, type SakUtfall } from "./types.ts";
import { oppdateringForUtfall, utfallAvslutter } from "./utfall.ts";

export type Resultat = { ok: true } | { ok: false; feil: string };
export type FristStatus = "aktiv" | "fullfort" | "erstattet";

const FANT_IKKE_SAK = "Fant ikke saken.";
const FANT_IKKE_FRIST = "Fant ikke fristen.";
const KUNNE_IKKE_LAGRE = "Kunne ikke lagre. Prøv igjen.";
export const SAK_ENDRET = "Saken er endret i mellomtiden. Last siden på nytt og prøv igjen.";
export const FRIST_ENDRET = "Fristen er allerede endret. Last siden på nytt.";

/** Statusen til en frist, slik den er lagret. */
export function fristStatus(f: {
  fullfort: boolean;
  erstattet_at?: string | null;
}): FristStatus {
  if (!f.fullfort) return "aktiv";
  return f.erstattet_at ? "erstattet" : "fullfort";
}

export async function eierSak(
  db: SupabaseClient,
  brukerId: string,
  sakId: string,
): Promise<boolean> {
  const { data } = await db
    .from("saker")
    .select("id")
    .eq("id", sakId)
    .eq("bruker_id", brukerId)
    .maybeSingle();
  return !!data;
}

/**
 * Setter utfallet på en sak etter den ene regelen i utfall.ts. Et valg som
 * avslutter saken krever eksplisitt bekreftelse, også ved direkte kall.
 *
 * Samtidighet: oppdateringen gjelder bare hvis sist_endret er det samme som da
 * brukeren så saken. Én betinget UPDATE, så det finnes ikke noe vindu mellom
 * kontroll og skriving. En annen fane som har endret saken, gir SAK_ENDRET.
 */
export async function settSakUtfall(
  db: SupabaseClient,
  brukerId: string,
  sakId: string,
  utfall: SakUtfall | null,
  bekreftetAvslutning: boolean,
  forventetSistEndret: string,
): Promise<Resultat> {
  if (!forventetSistEndret) return { ok: false, feil: SAK_ENDRET };
  if (utfall !== null && !(SAK_UTFALL as readonly string[]).includes(utfall)) {
    return { ok: false, feil: "Ukjent utfall." };
  }
  if (utfallAvslutter(utfall) && bekreftetAvslutning !== true) {
    return { ok: false, feil: "Bekreft at saken skal avsluttes." };
  }
  if (!(await eierSak(db, brukerId, sakId))) return { ok: false, feil: FANT_IKKE_SAK };

  const { data, error } = await db
    .from("saker")
    .update(oppdateringForUtfall(utfall))
    .eq("id", sakId)
    .eq("bruker_id", brukerId)
    .eq("sist_endret", forventetSistEndret)
    .select("id");
  if (error) return { ok: false, feil: KUNNE_IKKE_LAGRE };
  // Saken finnes og eies (sjekket over), så ingen treff betyr at den er endret.
  if (!data || data.length === 0) return { ok: false, feil: SAK_ENDRET };
  return { ok: true };
}

/**
 * Marker en frist som fullført, eller angre (tilbake til aktiv). Sletter aldri.
 * Samtidighet: endringen gjelder bare fra tilstanden brukeren så (aktiv →
 * fullført, eller lukket → aktiv). Er den allerede endret, gir det FRIST_ENDRET.
 */
export async function settFristStatus(
  db: SupabaseClient,
  brukerId: string,
  fristId: string,
  ny: "aktiv" | "fullfort",
  naIso: string = new Date().toISOString(),
): Promise<Resultat & { sakId?: string }> {
  const { data: frist } = await db
    .from("frister")
    .select("id, sak_id")
    .eq("id", fristId)
    .eq("bruker_id", brukerId)
    .maybeSingle();
  if (!frist) return { ok: false, feil: FANT_IKKE_FRIST };
  if (!(await eierSak(db, brukerId, frist.sak_id))) {
    return { ok: false, feil: FANT_IKKE_FRIST };
  }

  const { data, error } = await db
    .from("frister")
    .update({
      fullfort: ny === "fullfort",
      fullfort_at: ny === "fullfort" ? naIso : null,
      erstattet_at: null,
      erstattet_av_brev_id: null,
    })
    .eq("id", fristId)
    .eq("bruker_id", brukerId)
    .eq("fullfort", ny !== "fullfort")
    .select("id");
  if (error) return { ok: false, feil: KUNNE_IKKE_LAGRE };
  if (!data || data.length === 0) return { ok: false, feil: FRIST_ENDRET };
  return { ok: true, sakId: frist.sak_id };
}

/**
 * Åpner en avsluttet sak igjen. Utfallet beholdes som historikk. Er saken
 * allerede åpen, er det en feil (ingen stille endring).
 */
export async function gjenapneSak(
  db: SupabaseClient,
  brukerId: string,
  sakId: string,
  forventetSistEndret: string,
): Promise<Resultat> {
  if (!forventetSistEndret) return { ok: false, feil: SAK_ENDRET };
  if (!(await eierSak(db, brukerId, sakId))) return { ok: false, feil: FANT_IKKE_SAK };
  const { data, error } = await db
    .from("saker")
    .update({ status: "aktiv" })
    .eq("id", sakId)
    .eq("bruker_id", brukerId)
    .eq("status", "fullfort")
    .eq("sist_endret", forventetSistEndret)
    .select("id");
  if (error) return { ok: false, feil: KUNNE_IKKE_LAGRE };
  // Allerede åpen, eller endret i en annen fane: i begge tilfeller må siden lastes på nytt.
  if (!data || data.length === 0) return { ok: false, feil: SAK_ENDRET };
  return { ok: true };
}

/** Brukervennlig melding for en feil fra lagre_brev (migrasjon 0027). */
export function lagreBrevFeilmelding(melding: string | undefined | null): string {
  const m = melding ?? "";
  if (m.includes("MEDHOLD_SAK_ENDRET"))
    return "Saken er endret i mellomtiden. Last siden på nytt og prøv igjen. Ingenting ble lagret.";
  if (m.includes("MEDHOLD_FANT_IKKE_SAK")) return "Fant ikke saken. Ingenting ble lagret.";
  if (m.includes("MEDHOLD_AVSLUTNING_IKKE_BEKREFTET"))
    return "Bekreft at saken skal avsluttes. Ingenting ble lagret.";
  if (m.includes("MEDHOLD_UGYLDIG_UTFALL")) return "Ukjent utfall. Ingenting ble lagret.";
  if (m.includes("MEDHOLD_FRIST_ERSTATTET"))
    return "En av de eldre fristene er allerede endret. Last siden på nytt. Ingenting ble lagret.";
  return "Kunne ikke lagre brevet. Ingenting ble lagret. Prøv igjen.";
}
