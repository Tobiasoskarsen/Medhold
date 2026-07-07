// Domenetyper for Medhold. Holdes i synk med supabase/migrations.

import type { Stadium, BrevType } from "./gjeld";

export const SAK_STATUSER = ["aktiv", "venter_pa_svar", "fullfort"] as const;
export type SakStatus = (typeof SAK_STATUSER)[number];

export const SAK_KATEGORIER = [
  "helse",
  "okonomi",
  "familie",
  "bolig",
  "annet",
] as const;
export type SakKategori = (typeof SAK_KATEGORIER)[number];

export type Sak = {
  id: string;
  bruker_id: string;
  tittel: string;
  beskrivelse: string | null;
  status: SakStatus;
  kategori: SakKategori;
  opprettet: string;
  sist_endret: string;
  // Gjeld/inkasso-felter (nullable — kun satt for gjeldskrav). Se 0007.
  kreditor: string | null;
  opprinnelig_kreditor: string | null;
  saksnummer: string | null;
  belop_hovedstol: number | null;
  belop_totalt: number | null;
  stadium: Stadium | null;
};

// Hvor en frist kommer fra (0009). 'beregnet' vises som «beregnet — sjekk
// brevet» i UI; 'manuell'/'brev_eksplisitt' vises uten forbehold.
export const FRIST_KILDER = ["manuell", "brev_eksplisitt", "beregnet"] as const;
export type FristKilde = (typeof FRIST_KILDER)[number];

export type Frist = {
  id: string;
  sak_id: string;
  bruker_id: string;
  tittel: string;
  forfallsdato: string; // ISO-dato (YYYY-MM-DD)
  fullfort: boolean;
  notat: string | null;
  kilde: FristKilde;
  brev_id: string | null;
  opprettet: string;
};

// Frist sammen med saken den hører til (for «Kommende frister»-oversikten).
export type FristMedSak = Frist & {
  saker: { tittel: string; kategori: SakKategori } | null;
};

export type NesteSteg = {
  id: string;
  sak_id: string;
  bruker_id: string;
  tekst: string;
  fullfort: boolean;
  rekkefolge: number;
  opprettet: string;
};

export type ForeslattFrist = {
  tittel: string;
  forfallsdato: string; // YYYY-MM-DD, eller tom streng hvis ingen konkret dato
};

export type BrevAnalyse = {
  forklaring: string;
  foreslatte_steg: string[];
  foreslatte_frister: ForeslattFrist[];
};

// En foreslått frist med kilde — brukes i «legg til brev»-flyten der både
// eksplisitte (fra brevet) og beregnede frister vises som av/på-rader.
export type FristForslag = ForeslattFrist & { kilde: FristKilde };

// Utdatert fra Fase 1 — erstattes av Brev. Beholdes til de gamle skjermene
// fjernes i Fase 2.
export type DocumentNote = BrevAnalyse & {
  id: string;
  sak_id: string;
  bruker_id: string;
  original_tekst: string;
  opprettet: string;
};

// Et analysert brev (0008). Erstatter DocumentNote som datamodell, beriket med
// felter AI trekker ut. Nullable-felter settes kun når de faktisk står i brevet.
export type Brev = {
  id: string;
  sak_id: string;
  bruker_id: string;
  brevdato: string | null; // YYYY-MM-DD
  avsender: string | null;
  brevtype: BrevType | null;
  belop: number | null;
  original_tekst: string;
  forklaring: string;
  foreslatte_steg: string[];
  foreslatte_frister: ForeslattFrist[];
  opprettet: string;
};

export type SamtaleRolle = "bruker" | "assistent";

export type BrevSamtaleMelding = {
  id: string;
  document_note_id: string;
  bruker_id: string;
  rolle: SamtaleRolle;
  innhold: string;
  opprettet: string;
};

// Logg over sendte fristpåminnelser (0006_varsler.sql). terskel = antall dager
// før forfall varselet gjaldt (7, 3 eller 1).
export type SendtVarsel = {
  id: string;
  frist_id: string;
  bruker_id: string;
  terskel: number;
  sendt_at: string;
};

// Tilgangsplan (0011). Tilgangsstyring skjer via src/lib/plan.ts, ikke direkte.
export const PLANER = ["gratis", "pluss"] as const;
export type Plan = (typeof PLANER)[number];

export type Profil = {
  bruker_id: string;
  plan: Plan;
  opprettet: string;
  sist_endret: string;
};

// Utkasttyper (0013). Generert svarbrev brukeren redigerer og sender selv.
export const UTKAST_TYPER = [
  "innsigelse",
  "betalingsutsettelse",
  "klage",
] as const;
export type UtkastType = (typeof UTKAST_TYPER)[number];

export const UTKAST_ETIKETT: Record<UtkastType, string> = {
  innsigelse: "Innsigelse",
  betalingsutsettelse: "Betalingsutsettelse",
  klage: "Klage",
};

// Ledetekst for det korte skjemaet brukeren fyller ut per utkasttype.
export const UTKAST_SPORSMAL: Record<UtkastType, string> = {
  innsigelse: "Hva er du uenig i?",
  betalingsutsettelse: "Hva kan du betale per måned?",
  klage: "Hvorfor mener du vedtaket er feil?",
};

export type Utkast = {
  id: string;
  sak_id: string;
  bruker_id: string;
  brev_id: string | null;
  type: UtkastType;
  innhold: string;
  opprettet: string;
};

export const STATUS_ETIKETT: Record<SakStatus, string> = {
  aktiv: "Aktiv",
  venter_pa_svar: "Venter på svar",
  fullfort: "Fullført",
};

export const KATEGORI_ETIKETT: Record<SakKategori, string> = {
  helse: "Helse",
  okonomi: "Økonomi",
  familie: "Familie",
  bolig: "Bolig",
  annet: "Annet",
};

// Rolige fargepaletter for status-merker (Tailwind-klasser).
export const STATUS_STIL: Record<SakStatus, string> = {
  aktiv: "bg-blue-50 text-blue-700 ring-blue-200",
  venter_pa_svar: "bg-amber-50 text-amber-700 ring-amber-200",
  fullfort: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const KATEGORI_STIL: Record<SakKategori, string> = {
  helse: "bg-rose-50 text-rose-700 ring-rose-200",
  okonomi: "bg-violet-50 text-violet-700 ring-violet-200",
  familie: "bg-teal-50 text-teal-700 ring-teal-200",
  bolig: "bg-orange-50 text-orange-700 ring-orange-200",
  annet: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function erStatus(verdi: unknown): verdi is SakStatus {
  return (
    typeof verdi === "string" && SAK_STATUSER.includes(verdi as SakStatus)
  );
}

export function erKategori(verdi: unknown): verdi is SakKategori {
  return (
    typeof verdi === "string" &&
    SAK_KATEGORIER.includes(verdi as SakKategori)
  );
}
