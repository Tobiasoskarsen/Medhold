// Utkast-vakten (MEDHOLD_SIKKERHET_ARBEIDSORDRE §D.2). Ren, deterministisk
// kode — «AI tolker, kode beslutter», også for om et utkast er trygt å sende.
// Vakten sjekker at hvert beløp, hver dato og hver referanse i et generert
// utkast finnes i saken, at det ikke vises til paragrafer, at AI-en ikke har
// lagt påstander i personens munn, og at et delvis bestridt krav ikke blir
// omtalt som helt bestridt. Vakten BLOKKERER ALDRI (guardrail 5): funnene gir
// én regenerering og deretter en advarsel — brukeren bestemmer alltid.
import { tolkKr } from "./format.ts";
import { finnFraser } from "./tekstsok.ts";

export type VaktFakta = {
  tillatteBelop: number[]; // kroner
  tillatteDatoer: string[]; // ISO. År «0000» = ukjent år (dato uten år i brevet)
  tillatteTokens: string[]; // saksnr., kontonr., fakturanr. o.l.
  detaljer: string; // det personen selv skrev
  omfang: "delvis" | "helt" | null;
  /** Hvor hver verdi kommer fra, for «Sjekk før du sender» (§D.4). */
  kilder?: KildeOppslag;
};

export type VaktFunn = {
  type: "belop" | "dato" | "token" | "paragraf" | "pastand" | "omfang";
  /** Til brukeren, i «Sjekk før du sender». */
  tekst: string;
  /** Til modellen, i den ene regenereringen. */
  rettelinje: string;
};

export type Kilde = "brevet" | "gebyrsjekken" | "deg" | "avdragsforslaget" | "idag";
export type KildeOppslag = Record<Kilde, { belop: number[]; datoer: string[] }>;

/** Visningsetikett per kilde. Rekkefølgen her er prioriteten (§D.4). */
export const KILDE_ETIKETT: Record<Kilde, string> = {
  brevet: "fra brevet",
  gebyrsjekken: "fra gebyrsjekken",
  deg: "fra deg",
  avdragsforslaget: "fra avdragsforslaget",
  idag: "dagens dato",
};
const KILDE_REKKEFOLGE: Kilde[] = [
  "brevet",
  "gebyrsjekken",
  "deg",
  "avdragsforslaget",
  "idag",
];

// --- Uttrekk ---------------------------------------------------------------

const MANEDER = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

export type FunnetDato = { dag: number; maned: number; ar: number | null; tekst: string };
export type FunnetBelop = { belop: number; tekst: string };
export type Uttrekk = {
  belop: FunnetBelop[];
  datoer: FunnetDato[];
  tokens: string[];
  paragrafer: string[];
};

/** Erstatter et treff med like mange mellomrom, så posisjonene står fast og
 * senere søk ikke ser tegnene på nytt. */
function masker(tekst: string, start: number, lengde: number): string {
  return tekst.slice(0, start) + " ".repeat(lengde) + tekst.slice(start + lengde);
}

function gyldigDato(dag: number, maned: number): boolean {
  return dag >= 1 && dag <= 31 && maned >= 1 && maned <= 12;
}

const DATO_LANG = new RegExp(
  `(?<![\\p{L}\\p{N}])(\\d{1,2})\\.\\s*(${MANEDER.join("|")})(?:\\s+(\\d{4}))?(?![\\p{L}\\p{N}])`,
  "giu",
);
const DATO_TALL = /(?<![\p{N}.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\p{N}|\.\p{N})/gu;
const DATO_ISO = /(?<![\p{L}\p{N}-])(\d{4})-(\d{2})-(\d{2})(?![\p{L}\p{N}-])/gu;
const PARAGRAF = /§+\s*(?:\d+\s*[a-z]?(?:\s*[-–]\s*\d+)?)?|(?<![\p{L}])paragraf\p{L}*(?:\s+\d+)?/giu;
const TOKEN = /(?<![\p{L}\p{N}.-])[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?(?![\p{L}\p{N}])/gu;
const BELOP = /(?<![\p{L}\p{N}])(?:\d{1,3}(?:[  .]\d{3})+|\d+)(?:,(?:\d{1,2}|-{1,2}))?(?![\p{N}])/gu;
const ENHET_ETTER = /^\s*(?:virke)?(?:dag|døgn|uke|måned|år)/iu;

function erToken(t: string): boolean {
  const sifre = (t.match(/\p{N}/gu) ?? []).length;
  if (sifre < 4) return false;
  if (!/[\p{L}.-]/u.test(t)) return false;
  // Beløp med punktum som tusenskille («3.201») og «1288kr» er beløp, ikke tokens.
  if (/^\d{1,3}(?:\.\d{3})+$/.test(t)) return false;
  if (/^\d+(?:[.,]\d+)?kr$/i.test(t)) return false;
  return true;
}

/**
 * Finner beløp, datoer, referanser (tokens) og paragrafhenvisninger i en
 * tekst. `alleTall` tar med tall som ellers ignoreres (små tall foran
 * «dager»/«måneder», årstall) — brukt når fakta samles, så alt som står i
 * brevet er tillatt.
 */
export function trekkUt(tekst: string, alleTall = false): Uttrekk {
  let t = tekst;
  const datoer: FunnetDato[] = [];
  const tokens: string[] = [];
  const paragrafer: string[] = [];
  const belop: FunnetBelop[] = [];

  for (const m of t.matchAll(DATO_ISO)) {
    const ar = Number(m[1]);
    const maned = Number(m[2]);
    const dag = Number(m[3]);
    if (!gyldigDato(dag, maned)) continue;
    datoer.push({ dag, maned, ar, tekst: m[0] });
    t = masker(t, m.index, m[0].length);
  }
  for (const m of t.matchAll(DATO_LANG)) {
    const dag = Number(m[1]);
    const maned = MANEDER.indexOf(m[2].toLowerCase()) + 1;
    if (!gyldigDato(dag, maned)) continue;
    datoer.push({ dag, maned, ar: m[3] ? Number(m[3]) : null, tekst: m[0] });
    t = masker(t, m.index, m[0].length);
  }
  for (const m of t.matchAll(DATO_TALL)) {
    const dag = Number(m[1]);
    const maned = Number(m[2]);
    if (!gyldigDato(dag, maned)) continue;
    const ar = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    datoer.push({ dag, maned, ar, tekst: m[0] });
    t = masker(t, m.index, m[0].length);
  }
  for (const m of t.matchAll(PARAGRAF)) {
    paragrafer.push(m[0].trim());
    t = masker(t, m.index, m[0].length);
  }
  for (const m of t.matchAll(TOKEN)) {
    if (!erToken(m[0])) continue;
    tokens.push(m[0]);
    t = masker(t, m.index, m[0].length);
  }
  for (const m of t.matchAll(BELOP)) {
    const n = tolkKr(m[0]);
    if (n === null) continue;
    if (!alleTall) {
      const etter = t.slice(m.index + m[0].length);
      const heltall = /^\d+$/.test(m[0]);
      if (heltall && n < 32 && ENHET_ETTER.test(etter)) continue;
      const krRundt =
        /^\s*kr/i.test(etter) || /kr\.?\s*$/i.test(t.slice(0, m.index));
      if (heltall && n >= 2000 && n <= 2099 && !krRundt) continue;
    }
    belop.push({ belop: n, tekst: m[0].trim() });
  }

  return { belop, datoer, tokens, paragrafer };
}

// --- Påstander og omfang ---------------------------------------------------

type Pastand = { fraser: string[]; krav: string[]; rettelinje: string; bruker: string };

// Fraselistene er utvidet med de vanligste bøyningene («oppsigelsen»,
// «kvitteringen» …), siden finnFraser bruker ordgrenser og ellers ville gått
// glipp av dem. «bevis» og «e-post» godtas som dokumentasjon (Brev 1:
// «har eposten som bevis»). Se PROSJEKT_STATUS «Valg tatt underveis».
const PASTANDER: Pastand[] = [
  {
    fraser: ["sa opp", "sagt opp", "oppsigelse", "oppsigelsen"],
    krav: ["opp"],
    rettelinje: "Personen har ikke skrevet at hen har sagt opp. Fjern påstanden.",
    bruker: "at du har sagt opp",
  },
  {
    fraser: ["klaget", "reklamert", "reklamasjon", "reklamasjonen"],
    krav: ["klag", "reklam"],
    rettelinje: "Personen har ikke skrevet at hen har klaget. Fjern påstanden.",
    bruker: "at du har klaget",
  },
  {
    fraser: [
      "kvittering",
      "kvitteringen",
      "kvitteringer",
      "dokumentasjon",
      "dokumentasjonen",
      "vedlagt",
      "bekreftelse på",
    ],
    krav: ["kvitter", "dokument", "vedlegg", "bekreft", "skjermbilde", "bevis", "epost", "e-post"],
    rettelinje:
      "Personen har ikke skrevet at hen har dokumentasjon. Fjern påstanden.",
    bruker: "at du har dokumentasjon",
  },
];

const OMFANG_HELT = [
  "betaler ikke kravet",
  "bestrider kravet i sin helhet",
  "bestrider hele kravet",
];

/** Setninger: deler på .!? fulgt av stor bokstav, og på linjeskift — så «12. juli» ikke deler. */
function setninger(tekst: string): string[] {
  return tekst
    .split(/(?<=[.!?])\s+(?=[\p{Lu}«"])|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Faktapastand = {
  tema: "betaling" | "mottak" | "bestridelse";
  negativ: boolean;
  usikker: boolean;
  hel: boolean;
  delvis: boolean;
  objekt: string | null;
  belop: number[];
};

/**
 * Avgrenset språkvakt, ikke en norsk språkforståer. Bare uttrykkelig støtte
 * i brukerens detaljer kan bekrefte en betalingshistorikk. Tall/datoer fra
 * brevet beviser ikke at brukeren har betalt eller mottatt en faktura.
 * Ukjent ordstilling, hypotetiske og refererte utsagn brukes ikke som belegg.
 */
function faktapastander(tekst: string): Faktapastand[] {
  const ledd = setninger(tekst).flatMap((s) =>
    s.toLowerCase().split(/\s+(?:men|mens)\s+|;|,\s*(?=jeg\b)|\s+og\s+(?=(?:jeg|resten|hele|kravet|fakturaen)\b)/u),
  );
  return ledd.flatMap((s) => {
    const betaling = /\b(?:betalt|betalte|innbetalt|innbetalte|oppgjort)\b|\bgjort\s+opp\b/u.test(s);
    const mottak = /\b(?:har|hadde)\s+(?:(?:jeg|ikke|aldri|ennå|allerede|faktisk|nå)\s+)*(?:mottatt|fått)\b|\b(?:mottok|fikk)\s+(?:jeg\s+)?|\b(?:mottatt|fått)\b.*\b(?:har|hadde)\s+jeg\b/u.test(s);
    const bestridelse = /\bbestrid(?:er|te)\b/u.test(s);
    if (!betaling && !mottak && !bestridelse) return [];
    const negativ = /\b(?:ikke|aldri|verken)\b/u.test(s);
    const usikker = /\b(?:kanskje|muligens|tror|hvis|dersom|sier|sa|sagt|hevder|påstår|kan|ville|skal|vil)\b|\b(?:vet\s+ikke|usikker|ikke\s+bare)\b/u.test(s);
    const objekt = /\bfaktura\p{L}*/u.test(s) ? "faktura"
      : /\bgebyr\p{L}*/u.test(s) ? "gebyr"
      : /\bhovedstol\p{L}*/u.test(s) ? "hovedstol"
      : /\b(?:brevet|brev|varselet|inkassovarselet|betalingsoppfordringen)\b/u.test(s) ? "brev"
      : /\bkrav\p{L}*/u.test(s) ? "krav" : null;
    const belop = trekkUt(s).belop.map((b) => b.belop);
    const hel = /\b(?:hele|alt|oppgjort)\b|\bgjort\s+opp\b|\b(?:kravet|fakturaen)\s+er\s+betalt\b/u.test(s);
    const delvis = belop.length > 0 || /\b(?:delvis|delbetaling|delen|resten)\b/u.test(s);
    const tema: Faktapastand["tema"] = betaling ? "betaling" : mottak ? "mottak" : "bestridelse";
    // Flere tema i samme ledd har uklar rekkevidde for negasjonen. Ingen
    // automatisk godkjenning av slike ledd, selv om nøkkelordene er like.
    return [{ tema, negativ, usikker: usikker || Number(betaling) + Number(mottak) + Number(bestridelse) > 1,
      hel, delvis, objekt, belop }];
  });
}

function sammeObjekt(a: Faktapastand, b: Faktapastand): boolean {
  return a.objekt === b.objekt || a.objekt === null || b.objekt === null;
}

function sjekkFaktapastander(utkast: string, fakta: VaktFakta): VaktFunn[] {
  // Bevisst bare brukerens egne opplysninger; ikke original_tekst eller
  // tillatteBelop (som kommer fra flere kilder og har en annen betydning).
  const belegg = faktapastander(fakta.detaljer);
  return faktapastander(utkast).flatMap((p): VaktFunn[] => {
    const relevante = belegg.filter((b) => b.tema === p.tema && sammeObjekt(p, b));
    const motstrid = relevante.some((b) => b.usikker || b.negativ !== p.negativ);
    const stotte = relevante.some((b) => !b.usikker && b.negativ === p.negativ &&
      (!p.hel || (b.hel && !b.delvis)) &&
      (!b.delvis || p.belop.length > 0 || p.delvis) &&
      p.belop.every((n) => b.belop.some((m) => Math.abs(n - m) <= 0.01)));
    // Et svar kan anerkjenne selve brevet og uttrykke valgt standpunkt.
    // Dette unntaket bekrefter ingen historisk betaling eller fakturamottak,
    // og gjelder aldri når detaljene sier noe annet eller er usikre.
    const standpunkt = p.tema === "bestridelse" && relevante.length === 0;
    const brevMottatt = p.tema === "mottak" && p.objekt === "brev" && !p.negativ && relevante.length === 0;
    if (!p.usikker && !motstrid && (stotte || standpunkt || brevMottatt)) return [];
    const rettelinje = p.tema === "betaling" && !p.negativ
      ? "Personen har ikke skrevet at hen har betalt. Fjern påstanden."
      : `Påstanden om ${p.tema} mangler entydig støtte eller motsier brukerens opplysninger. Fjern eller rett påstanden; ikke gjett.`;
    return [{ type: "pastand", tekst: `Sjekk påstanden om ${p.tema}: den mangler entydig støtte eller kan motsi det du har skrevet.`, rettelinje }];
  });
}

// --- Kontroll --------------------------------------------------------------

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 })
    .format(n)
    .replace(/ /g, " ");
}

function iso(d: FunnetDato, ar: number | null = d.ar): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ar === null ? "0000" : String(ar).padStart(4, "0")}-${p(d.maned)}-${p(d.dag)}`;
}

function datoTillatt(d: FunnetDato, tillatte: string[]): boolean {
  return tillatte.some((t) => {
    const [ar, mnd, dag] = t.split("-").map(Number);
    if (mnd !== d.maned || dag !== d.dag) return false;
    return d.ar === null || ar === 0 || ar === d.ar;
  });
}

function belopTillatt(n: number, tillatte: number[]): boolean {
  return tillatte.some((t) => Math.abs(t - n) <= 0.01);
}

/**
 * Kontrollerer et utkast mot sakens fakta. Tom liste = ingen funn. Rekkefølgen
 * på funnene følger teksten innen hver vakt; like funn slås sammen.
 */
export function kontrollerUtkast(utkast: string, fakta: VaktFakta): VaktFunn[] {
  const funn: VaktFunn[] = [];
  const sett = new Set<string>();
  const legg = (f: VaktFunn) => {
    const nokkel = `${f.type}|${f.rettelinje}`;
    if (sett.has(nokkel)) return;
    sett.add(nokkel);
    funn.push(f);
  };

  const u = trekkUt(utkast);

  for (const b of u.belop) {
    if (belopTillatt(b.belop, fakta.tillatteBelop)) continue;
    legg({
      type: "belop",
      tekst: `${kr(b.belop)} kr finnes ikke i brevet ditt. Sjekk beløpet.`,
      rettelinje: `Beløpet ${kr(b.belop)} kr finnes ikke i saken. Bruk kun beløp fra brevet eller fakta fra Medhold.`,
    });
  }

  for (const d of u.datoer) {
    if (datoTillatt(d, fakta.tillatteDatoer)) continue;
    legg({
      type: "dato",
      tekst: `Datoen ${d.tekst} finnes ikke i brevet ditt. Sjekk datoen.`,
      rettelinje: `Datoen ${d.tekst} finnes ikke i saken. Bruk kun datoer fra brevet eller det personen selv har skrevet.`,
    });
  }

  for (const t of u.tokens) {
    if (fakta.tillatteTokens.includes(t)) continue;
    legg({
      type: "token",
      tekst: `«${t}» finnes ikke i brevet ditt. Sjekk saksnummeret.`,
      rettelinje: `«${t}» finnes ikke i saken. Bruk kun saksnummer og referanser nøyaktig slik de står i brevet.`,
    });
  }

  if (u.paragrafer.length > 0) {
    legg({
      type: "paragraf",
      tekst: "Utkastet viser til en paragraf. Sjekk den, eller fjern den.",
      rettelinje: "Fjern paragrafhenvisningen.",
    });
  }

  const detaljer = fakta.detaljer.toLowerCase();
  for (const f of sjekkFaktapastander(utkast, fakta)) legg(f);
  for (const s of setninger(utkast)) {
    if (finnFraser(s, ["jeg", "meg"]).length === 0) continue;
    for (const p of PASTANDER) {
      if (finnFraser(s, p.fraser).length === 0) continue;
      if (p.krav.some((k) => detaljer.includes(k))) continue;
      legg({
        type: "pastand",
        tekst: `Utkastet sier ${p.bruker}, men det har du ikke skrevet. Sjekk at det stemmer.`,
        rettelinje: p.rettelinje,
      });
    }
  }

  if (fakta.omfang === "delvis") {
    for (const frase of finnFraser(utkast, OMFANG_HELT)) {
      legg({
        type: "omfang",
        tekst:
          "Utkastet bestrider hele kravet, men du valgte bare gebyret. Sjekk teksten.",
        rettelinje: `Brevet skal bare bestride beløpet over maksimalsatsen. Fjern «${frase}».`,
      });
    }
  }

  return funn;
}

// --- Fakta -----------------------------------------------------------------

export type VaktGrunnlag = {
  originalTekst: string | null;
  belopTotalt: number | null;
  belopHovedstol: number | null;
  kostnadslinjer: { belop: number }[];
  gebyrsjekk: {
    linjer: {
      maksLav: number | null;
      maksHoy: number | null;
      differanse: number | null;
    }[];
  } | null;
  ubestridt: number | null;
  avdrag: { manedsbelop: number; antallMandeder: number; sisteAvdrag: number } | null;
  detaljer: string;
  brevdato: string | null;
  fristdato: string | null;
  idag: string;
  omfang: "delvis" | "helt" | null;
};

function tall(...n: (number | null | undefined)[]): number[] {
  return n.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

/**
 * Samler alle tillatte verdier for et utkast (§D.2): alt som står i brevet,
 * sakens og brevets beløp, gebyrsjekkens tall, den ubestridte delen,
 * avdragsforslaget, det personen selv skrev, og brevdato/frist/i dag.
 */
export function byggVaktFakta(g: VaktGrunnlag): VaktFakta {
  const brev = trekkUt(g.originalTekst ?? "", true);
  const deg = trekkUt(g.detaljer, true);
  const datoer = (u: Uttrekk) => u.datoer.map((d) => iso(d));

  const gebyrTall = g.gebyrsjekk
    ? g.gebyrsjekk.linjer.flatMap((l) => tall(l.maksLav, l.maksHoy, l.differanse))
    : [];
  const totalDiff = g.gebyrsjekk
    ? g.gebyrsjekk.linjer.reduce((s, l) => s + (l.differanse ?? 0), 0)
    : 0;

  const kilder: KildeOppslag = {
    brevet: {
      belop: [
        ...brev.belop.map((b) => b.belop),
        ...tall(g.belopTotalt, g.belopHovedstol),
        ...g.kostnadslinjer.map((l) => l.belop),
      ],
      datoer: [
        ...datoer(brev),
        ...[g.brevdato, g.fristdato].filter((d): d is string => !!d),
      ],
    },
    gebyrsjekken: {
      belop: [...gebyrTall, ...(totalDiff > 0 ? [totalDiff] : []), ...tall(g.ubestridt)],
      datoer: [],
    },
    deg: { belop: deg.belop.map((b) => b.belop), datoer: datoer(deg) },
    avdragsforslaget: {
      belop: g.avdrag
        ? tall(g.avdrag.manedsbelop, g.avdrag.antallMandeder, g.avdrag.sisteAvdrag)
        : [],
      datoer: [],
    },
    idag: { belop: [], datoer: [g.idag] },
  };

  return {
    tillatteBelop: KILDE_REKKEFOLGE.flatMap((k) => kilder[k].belop),
    tillatteDatoer: KILDE_REKKEFOLGE.flatMap((k) => kilder[k].datoer),
    tillatteTokens: [...brev.tokens, ...deg.tokens],
    detaljer: g.detaljer,
    omfang: g.omfang,
    kilder,
  };
}

// --- «Sjekk før du sender» -------------------------------------------------

export type VerdiLinje = { type: "belop" | "dato"; verdi: string; kilde: string | null };

/**
 * Tall og datoer i utkastet med kilden til høyre (§D.4). Kilden er den første
 * i rekkefølgen brevet → gebyrsjekken → deg → avdragsforslaget som inneholder
 * verdien; null = finnes ikke i saken (vises da som advarsel).
 */
export function verdierMedKilde(utkast: string, fakta: VaktFakta): VerdiLinje[] {
  const u = trekkUt(utkast);
  const linjer: VerdiLinje[] = [];
  const sett = new Set<string>();
  const kilder = fakta.kilder;

  for (const b of u.belop) {
    const verdi = `${kr(b.belop)} kr`;
    if (sett.has(verdi)) continue;
    sett.add(verdi);
    const k = kilder
      ? KILDE_REKKEFOLGE.find((kk) => belopTillatt(b.belop, kilder[kk].belop))
      : undefined;
    linjer.push({ type: "belop", verdi, kilde: k ? KILDE_ETIKETT[k] : null });
  }
  for (const d of u.datoer) {
    if (sett.has(d.tekst)) continue;
    sett.add(d.tekst);
    const k = kilder
      ? KILDE_REKKEFOLGE.find((kk) => datoTillatt(d, kilder[kk].datoer))
      : undefined;
    linjer.push({ type: "dato", verdi: d.tekst, kilde: k ? KILDE_ETIKETT[k] : null });
  }
  return linjer;
}
