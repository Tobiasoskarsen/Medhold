// Domenetyper for Medhold. Holdes i synk med supabase/migrations.

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
};

export type Frist = {
  id: string;
  sak_id: string;
  bruker_id: string;
  tittel: string;
  forfallsdato: string; // ISO-dato (YYYY-MM-DD)
  fullfort: boolean;
  notat: string | null;
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

export type DocumentNote = BrevAnalyse & {
  id: string;
  sak_id: string;
  bruker_id: string;
  original_tekst: string;
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
