import { beregnFrist, BREVTYPER, type BrevType } from "./gjeld.ts";
import { sammenlignFrist } from "./frist.ts";
import { erAlvorligSak } from "./alvorsgrense.ts";

export function gyldigDokumentdato(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v;
}
/** Samme eksisterende regler, på dokumentets dato, aldri dagens dato. */
export function kontrollerBrevfunn(f: { brevtype: BrevType | null; brevdato: string; original_tekst: string; fristIBrevet?: { tittel: string; forfallsdato: string } | null }) {
  if (typeof f.brevdato !== "string" || (f.brevdato && !gyldigDokumentdato(f.brevdato)) ||
      (f.fristIBrevet && (!gyldigDokumentdato(f.fristIBrevet.forfallsdato) || typeof f.fristIBrevet.tittel !== "string")) ||
      typeof f.original_tekst !== "string" || (f.brevtype !== null && !(BREVTYPER as readonly string[]).includes(f.brevtype)))
    return { ok: false as const, feil: "Kontroller brevtype og datoene mot brevet før du lagrer." };
  const beregnet = f.brevdato && f.brevtype ? beregnFrist(f.brevtype,f.brevdato) : null;
  return { ok: true as const, alvorlig: erAlvorligSak(f.original_tekst), fristfunn: sammenlignFrist(f.fristIBrevet ?? null,beregnet) };
}
