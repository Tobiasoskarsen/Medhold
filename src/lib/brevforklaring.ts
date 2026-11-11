import { formaterDato } from "./dato.ts";
import { formaterKr } from "./format.ts";

/** Brevtypen med artikkel, slik den leses i en setning (Del F.4). */
const TYPE_TEKST: Record<string, string> = {
  faktura: "en faktura",
  purring: "en purring",
  inkassovarsel: "et inkassovarsel",
  betalingsoppfordring: "en betalingsoppfordring",
  forliksrad: "et brev om forliksrådet",
  namsmann: "et brev om tvangsinndrivelse",
  nedbetaling: "et brev om nedbetaling",
  avsluttet: "et brev om at saken er avsluttet",
  annet: "et brev",
};

/** Forklaringer laget med den gamle skjemamalen begynner slik. */
export const GAMMEL_FORKLARING_START = "Opplysninger fra brevet:";

/**
 * Kort forklaring av brevet i to setninger, bygget bare av felt fra
 * dokumentlesingen og brukerens rettelser. Deterministisk, uten AI. Ingen
 * utledet historikk eller juridiske konsekvenser: gebyr- og fristvurdering
 * har egne paneler, og forbeholdet står én gang per skjerm.
 */
export function brevforklaring(f: { avsender: string; brevtype: string | null; brevdato: string; belop: number | null; saksnummer: string }): string {
  const type = (f.brevtype && Object.hasOwn(TYPE_TEKST, f.brevtype) ? TYPE_TEKST[f.brevtype] : null) ?? "et brev";
  const avsender = f.avsender.trim();
  const dato = f.brevdato ? `, datert ${formaterDato(f.brevdato)}` : "";
  const forste = avsender ? `Dette er ${type} fra ${avsender}${dato}.` : `Dette er ${type}${dato}.`;
  const nr = f.saksnummer.trim();
  const belop = f.belop === null ? "Vi fant ikke totalbeløpet i brevet." : `De krever ${formaterKr(f.belop)} kr.`;
  return [forste, nr ? `${belop} Saksnummeret er ${nr}.` : belop].join("\n\n");
}

/**
 * Teksten brevvisningen skal vise. Lagrede forklaringer fra den gamle malen
 * bygges på nytt fra brevets lagrede felt. Annen lagret tekst vises som før.
 * Ingen data endres.
 */
export function visForklaring(
  lagret: string | null,
  felt: { avsender: string | null; brevtype: string | null; brevdato: string | null; belop: number | null; saksnummer: string | null },
): string {
  if (lagret && !lagret.startsWith(GAMMEL_FORKLARING_START)) return lagret;
  if (!lagret) return "";
  return brevforklaring({
    avsender: felt.avsender ?? "",
    brevtype: felt.brevtype,
    brevdato: felt.brevdato ?? "",
    belop: felt.belop,
    saksnummer: felt.saksnummer ?? "",
  });
}
