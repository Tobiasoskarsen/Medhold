// Kvoter for AI-bruk og innlogging (Pakke A, A4). Grensene står i
// databasetabellen kvoter og håndheves av reserver_kvote/fullfor_kvote
// (migrasjon 0029), som bare service_role kan kalle. Klienten kan derfor
// verken se bort fra en grense eller frigi sin egen kvote.
//
// Flyten for en AI-handling:
//   1. reserver: teller med en gang, så samtidige kall ikke går over grensen
//   2. AI-kallet
//   3. fullfør: «brukt» hvis kallet ga et svar, «frigitt» ved operasjonelle
//      feil (tidsavbrudd, nettverk, travel tjeneste). Da belastes ikke brukeren.
//
// Relative importer med .ts-endelse, så filen også kan kjøres direkte av Node.
import { createHash, createHmac } from "node:crypto";
import { erOperasjonellFeil, type AiFeil } from "./ai-svar.ts";

export type KvoteHandling = "dokumentanalyse" | "chat" | "utkast";
type AlleHandlinger = KvoteHandling | "innlogging_epost" | "innlogging_ip";

export type KvoteSvar =
  | { ok: true; gruppe: string; igjen: number | null; gjentatt: boolean }
  | {
      ok: false;
      grunn: "kvote" | "pagar" | "gjentatt" | "feil";
      handling: AlleHandlinger | null;
      grense: number | null;
      nullstilles: string | null;
    };

export type Maling = {
  modell?: string;
  inn_tokens?: number;
  ut_tokens?: number;
  ai_kall?: number;
  varighet_ms?: number;
  feil?: AiFeil | "lagring" | "ingen_svar";
};

/** Det lille av Supabase-klienten vi bruker. Gjør funksjonene testbare. */
export type RpcKlient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLINGER = new Set<string>(["dokumentanalyse", "chat", "utkast", "innlogging_epost", "innlogging_ip"]);

const FEIL: KvoteSvar = { ok: false, grunn: "feil", handling: null, grense: null, nullstilles: null };

/** Streng tolkning av svaret fra reserver_kvote. Alt uventet er en feil. */
export function tolkKvoteSvar(x: unknown): KvoteSvar {
  if (!x || typeof x !== "object") return FEIL;
  const o = x as Record<string, unknown>;
  if (o.ok === true) {
    if (typeof o.gruppe !== "string" || !UUID.test(o.gruppe)) return FEIL;
    return {
      ok: true,
      gruppe: o.gruppe,
      igjen: typeof o.igjen === "number" ? o.igjen : null,
      gjentatt: o.gjentatt === true,
    };
  }
  if (o.ok === false && (o.grunn === "kvote" || o.grunn === "pagar" || o.grunn === "gjentatt")) {
    const handling = typeof o.handling === "string" && HANDLINGER.has(o.handling) ? (o.handling as AlleHandlinger) : null;
    const nullstilles = typeof o.nullstilles === "string" && !Number.isNaN(Date.parse(o.nullstilles)) ? o.nullstilles : null;
    return {
      ok: false,
      grunn: o.grunn,
      handling,
      grense: typeof o.grense === "number" ? o.grense : null,
      nullstilles,
    };
  }
  return FEIL;
}

/**
 * Et stabilt forsøk-id for samme innhold fra samme bruker. Sender brukeren
 * nøyaktig det samme på nytt (f.eks. fordi svaret gikk tapt), belastes det
 * ikke to ganger. Avledet av innholdet, så klienten ikke kan velge det fritt.
 */
export function forsokId(...deler: (string | number | null | undefined)[]): string {
  const h = createHash("sha256").update(JSON.stringify(deler)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Pseudonym nøkkel for e-post eller IP. Klartekst lagres aldri. HMAC med en
 * hemmelighet bare serveren har, så nøkkelen ikke kan slås opp fra en liste
 * med kjente e-postadresser.
 */
export function hmacNokkel(type: "epost" | "ip", verdi: string, hemmelighet: string): string {
  return createHmac("sha256", hemmelighet).update(`${type}:${verdi.trim().toLowerCase()}`).digest("hex");
}

/**
 * Klientens IP fra forespørselshodene. På Vercel settes x-vercel-forwarded-for
 * og x-real-ip av plattformen. IPv6 forkortes til /64: én husstand eller
 * mobilenhet får ofte mange adresser innenfor samme prefiks.
 */
export function klientIp(hent: (navn: string) => string | null): string | null {
  const raa =
    hent("x-vercel-forwarded-for")?.split(",")[0] ??
    hent("x-real-ip") ??
    hent("x-forwarded-for")?.split(",")[0] ??
    null;
  const ip = raa?.trim().toLowerCase() ?? "";
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (ip.includes(":")) {
    const deler = ip.split("%")[0].split(":");
    // Utvid «::» så de fire første gruppene alltid er prefikset.
    const tom = deler.indexOf("");
    const fulle = tom === -1 ? deler : [...deler.slice(0, tom), ...Array(8 - deler.filter(Boolean).length).fill("0"), ...deler.slice(tom).filter(Boolean)];
    return fulle.slice(0, 4).map((g) => g || "0").join(":") + "::/64";
  }
  return null;
}

/** Skal et AI-forsøk som endte slik, belastes brukeren? */
export function skalBelastes(feil: AiFeil | null): boolean {
  return feil === null || !erOperasjonellFeil(feil);
}

async function reserverRaa(
  db: RpcKlient,
  krav: { handling: AlleHandlinger; nokkel: string; bruker_id?: string }[],
  forsok: string | null,
): Promise<KvoteSvar> {
  try {
    const { data, error } = await db.rpc("reserver_kvote", { p_krav: krav, p_forsok: forsok });
    if (error) return FEIL;
    return tolkKvoteSvar(data);
  } catch {
    return FEIL;
  }
}

/**
 * Reserverer én enhet av en AI-kvote for brukeren. Et innhold som allerede er
 * gjentatt én gang, reserveres som et nytt forsøk (vanlig belastning).
 */
export async function reserverKvote(
  db: RpcKlient,
  handling: KvoteHandling,
  brukerId: string,
  forsok: string | null = null,
): Promise<KvoteSvar> {
  const krav = [{ handling, nokkel: brukerId, bruker_id: brukerId }];
  const svar = await reserverRaa(db, krav, forsok);
  if (!svar.ok && svar.grunn === "gjentatt") return reserverRaa(db, krav, null);
  return svar;
}

/** Reserverer en innloggingskode: e-post og IP i samme transaksjon. */
export async function reserverInnlogging(
  db: RpcKlient,
  epostNokkel: string,
  ipNokkel: string | null,
): Promise<KvoteSvar> {
  const krav: { handling: AlleHandlinger; nokkel: string }[] = [{ handling: "innlogging_epost", nokkel: epostNokkel }];
  if (ipNokkel) krav.push({ handling: "innlogging_ip", nokkel: ipNokkel });
  return reserverRaa(db, krav, null);
}

/** Avslutter en reservasjon. Feiler stille: reservasjonen utløper av seg selv. */
export async function fullforKvote(
  db: RpcKlient,
  gruppe: string,
  brukt: boolean,
  maling: Maling = {},
): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("fullfor_kvote", { p_gruppe: gruppe, p_brukt: brukt, p_maling: maling });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Klokkeslett i norsk tid, med «i morgen» når det ikke er i dag. */
export function nullstillesTekst(iso: string | null, naa: Date = new Date()): string {
  if (!iso) return "senere";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "senere";
  // Ett minutt fram: tellingen er «eldre enn», så et nytt forsøk på minuttet
  // kan fortsatt treffe grensen.
  const tid = new Date(t.getTime() + 60_000);
  const dag = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
  const kl = tid.toLocaleTimeString("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" });
  const iMorgen = new Date(naa.getTime() + 86_400_000);
  if (dag(tid) === dag(naa)) return `kl. ${kl}`;
  if (dag(tid) === dag(iMorgen)) return `i morgen kl. ${kl}`;
  return tid.toLocaleDateString("nb-NO", { timeZone: "Europe/Oslo", day: "numeric", month: "long" }) + ` kl. ${kl}`;
}

/** Meldingen brukeren ser når en grense er nådd. Sier alltid hva som fortsatt virker. */
export function kvoteMelding(svar: Extract<KvoteSvar, { ok: false }>, naa: Date = new Date()): string {
  if (svar.grunn === "pagar") return "Dette behandles allerede. Vent litt, så kommer svaret.";
  if (svar.grunn === "feil" || svar.grunn === "gjentatt")
    return "Vi får ikke sjekket bruken din akkurat nå. Prøv igjen om litt.";
  const n = svar.grense;
  const nar = nullstillesTekst(svar.nullstilles, naa);
  switch (svar.handling) {
    case "dokumentanalyse":
      return `Du har brukt ${n ?? "alle"} dokumentanalyser det siste døgnet. Du kan analysere et nytt brev ${nar}. Brevene og sakene du har lagret, kan du fortsatt åpne.`;
    case "chat":
      return `Du har sendt ${n ?? "mange"} spørsmål det siste døgnet. Du kan spørre igjen ${nar}. Brevet og samtalen kan du fortsatt lese.`;
    case "utkast":
      return `Du har laget ${n ?? "alle"} nye utkast det siste døgnet. Du kan lage et nytt ${nar}. Utkastene du har lagret, kan du fortsatt åpne og redigere.`;
    case "innlogging_epost":
      return `Det er bedt om mange koder til denne e-postadressen. Prøv igjen ${nar}, eller bruk den siste koden du fikk.`;
    case "innlogging_ip":
      return `Det er bedt om mange innloggingskoder fra dette nettverket. Prøv igjen ${nar}.`;
    default:
      return "Du har nådd grensen for nå. Prøv igjen senere.";
  }
}
