import type { SakKategori } from "@/lib/types";

// Maler for vanlige krisetyper. Hver mal lager en sak + konkrete neste steg.
// Bevisst INGEN oppdiktede datoer/frister — kun handlinger brukeren kan ta.
// Stegene er generell veiledning, ikke autoritativ rådgivning.

export type Mal = {
  id: string;
  tittel: string;
  kategori: SakKategori;
  kort: string; // kort beskrivelse på malkortet
  beskrivelse: string; // settes som sakens beskrivelse
  steg: string[];
};

export const MALER: Mal[] = [
  {
    id: "sykdom",
    tittel: "Alvorlig sykdom",
    kategori: "helse",
    kort: "Du eller en nær har blitt alvorlig syk.",
    beskrivelse:
      "Oversikt over det praktiske rundt en alvorlig sykdom — behandling, rettigheter og folkene rundt deg.",
    steg: [
      "Be fastlege eller sykehus om en plan for behandling og oppfølging",
      "Sjekk rettighetene dine hos NAV (sykepenger, arbeidsavklaringspenger)",
      "Gi beskjed til arbeidsgiver eller studiested",
      "Spør om du har rett på en fast kontaktperson eller koordinator",
      "Undersøk pasientreiser og egenandelstak",
      "Fortell noen du stoler på hvordan de kan hjelpe",
    ],
  },
  {
    id: "gjeld",
    tittel: "Gjeld og økonomi",
    kategori: "okonomi",
    kort: "Regningene har vokst seg uoversiktlige.",
    beskrivelse:
      "Få oversikt over økonomien og finn vei ut av gjeld, ett skritt av gangen.",
    steg: [
      "Skaff oversikt over all gjeld, inntekt og faste utgifter",
      "Kontakt NAV for gratis økonomisk rådgivning / gjeldsrådgivning",
      "Ta kontakt med kreditorene om betalingsutsettelse eller nedbetalingsavtale",
      "Sjekk om du har krav på bostøtte eller sosialhjelp",
      "Sett opp et enkelt budsjett for måneden",
      "Samle inkassovarsler og krav på ett sted",
    ],
  },
  {
    id: "samlivsbrudd",
    tittel: "Samlivsbrudd",
    kategori: "familie",
    kort: "Et forhold eller ekteskap tar slutt.",
    beskrivelse:
      "Det praktiske rundt et samlivsbrudd — bolig, barn, økonomi og papirarbeid.",
    steg: [
      "Avklar bosituasjonen på kort sikt",
      "Kontakt familievernkontoret (mekling er påkrevd når dere har barn)",
      "Lag en avtale om samvær og barnebidrag hvis dere har barn",
      "Del felles økonomi, lån og eiendeler",
      "Oppdater adresse i Folkeregisteret og hos viktige instanser",
      "Sjekk om du har rett på støtteordninger som enslig forsørger",
    ],
  },
  {
    id: "dodsfall",
    tittel: "Dødsfall i familien",
    kategori: "familie",
    kort: "Du har mistet noen som stod deg nær.",
    beskrivelse:
      "Hjelp til å holde styr på det praktiske etter et dødsfall, så du kan ta sorgen i ditt eget tempo.",
    steg: [
      "Kontakt et begravelsesbyrå — de hjelper med mye av det praktiske",
      "Skaff dødsattest fra lege eller sykehus",
      "Meld dødsfallet til skifteretten (skifteattest eller uskifte)",
      "Si opp eller overfør abonnementer, forsikringer og avtaler",
      "Kontakt NAV om gravferdsstønad og eventuell etterlattepensjon",
      "Husk å ta vare på deg selv — sorg tar tid, og du trenger ikke gjøre alt på en gang",
    ],
  },
];

export function finnMal(id: string): Mal | undefined {
  return MALER.find((m) => m.id === id);
}
