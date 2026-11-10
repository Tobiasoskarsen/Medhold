// Deterministisk maskering av norske fødselsnumre i fritekst. Brukes på
// brevtekst FØR lagring, slik at fødselsnumre ikke havner i databasen eller
// sendes videre i brev-samtalen. Ingen AI-skjønn — ren kode.
//
// Presisjon er poenget: et fødselsnummer har TO mod11-kontrollsifre. Norske
// kontonumre (også 11 sifre) og KID-numre bruker et annet sjekksum-oppsett og
// vil praktisk talt aldri passere begge fødselsnummer-kontrollene. Vi maskerer
// derfor kun 11-sifrede sekvenser som faktisk validerer som fødselsnummer.

const K1_VEKTER = [3, 7, 6, 1, 8, 9, 4, 5, 2];
const K2_VEKTER = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

function kontrollsiffer(sifre: number[], vekter: number[]): number | null {
  const sum = vekter.reduce((acc, v, i) => acc + v * sifre[i], 0);
  const rest = sum % 11;
  const siffer = rest === 0 ? 0 : 11 - rest;
  return siffer === 10 ? null : siffer; // 10 finnes ikke i et gyldig nummer
}

/** Er de 11 sifrene et gyldig fødselsnummer (begge mod11-kontrollene stemmer)? */
export function erGyldigFodselsnummer(elleveSifre: string): boolean {
  if (!/^\d{11}$/.test(elleveSifre)) return false;
  const s = elleveSifre.split("").map(Number);
  const k1 = kontrollsiffer(s.slice(0, 9), K1_VEKTER);
  const k2 = kontrollsiffer(s.slice(0, 10), K2_VEKTER);
  return k1 !== null && k2 !== null && k1 === s[9] && k2 === s[10];
}

// 11 sifre, med valgfritt ett skilletegn (mellomrom, punktum eller bindestrek)
// etter de 6 første, og ikke som del av et lengre siffertall.
const KANDIDAT = /(?<!\d)\d{6}[ .-]?\d{5}(?!\d)/g;

/** Erstatter gyldige fødselsnumre i teksten med en tydelig etikett. */
export function maskerFodselsnummer(tekst: string): string {
  return tekst.replace(KANDIDAT, (treff) => {
    const rene = treff.replace(/[\s.-]/g, "");
    return erGyldigFodselsnummer(rene) ? "[fødselsnummer skjult]" : treff;
  });
}

/**
 * Maskerer fødselsnumre i alle tekstverdier i et objekt eller en liste, også
 * nestede. Tall, datoer og andre verdier røres ikke, så beløp og frister
 * beholdes. Brukes på serveren før lagring, uansett hva klienten sendte.
 */
export function maskerAlleStrenger<T>(verdi: T): T {
  if (typeof verdi === "string") return maskerFodselsnummer(verdi) as T;
  if (Array.isArray(verdi)) return verdi.map((v) => maskerAlleStrenger(v)) as T;
  if (verdi && typeof verdi === "object") {
    const ut: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(verdi as Record<string, unknown>)) ut[k] = maskerAlleStrenger(v);
    return ut as T;
  }
  return verdi;
}
