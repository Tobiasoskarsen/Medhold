import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendFristPaaminnelse,
  sendOppfolging,
  type FristVarsel,
} from "@/lib/epost";
import { oppfolgingsKandidater, type VenterSak } from "@/lib/oppfolging";
import { idagOslo } from "@/lib/dato";

// Kjøres av Vercel Cron én gang i døgnet (se vercel.json). Kan ta litt tid hvis
// mange e-poster skal ut — gi den rom slik at den ikke kuttes av timeouten.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Hvor mange dager før forfall vi sender påminnelse. Gir opptil tre rolige nudge
// per frist. Én rad i sendte_varsler per (frist, terskel) hindrer duplikater.
const TERSKLER = [7, 3, 1] as const;

/** Hele dager mellom to rene datoer (YYYY-MM-DD), tolket som UTC-midnatt. */
function dagerMellom(fra: string, til: string): number {
  const a = Date.parse(`${fra}T00:00:00Z`);
  const b = Date.parse(`${til}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

type FristRad = {
  id: string;
  tittel: string;
  forfallsdato: string;
  bruker_id: string;
  saker: { tittel: string } | { tittel: string }[] | null;
};

function sakTittel(saker: FristRad["saker"]): string | null {
  if (!saker) return null;
  return Array.isArray(saker) ? (saker[0]?.tittel ?? null) : saker.tittel;
}

type OppfolgingResultat = {
  kandidater: number;
  sendt: number;
  avmeldt: number;
};

/**
 * Fase B: én rolig oppfølging for saker som har stått i «venter på svar» ≥ 14
 * dager uten aktivitet, og ikke er fulgt opp før. Respekterer samme av/på-bryter
 * som fristpåminnelsene. Én e-post per sak (per kreditor).
 */
async function kjorOppfolging(
  supabase: ReturnType<typeof createAdminClient>,
  dryRun: boolean,
): Promise<OppfolgingResultat> {
  const tom: OppfolgingResultat = { kandidater: 0, sendt: 0, avmeldt: 0 };

  const { data: venter } = await supabase
    .from("saker")
    .select("id, bruker_id, kreditor")
    .eq("status", "venter_pa_svar");
  if (!venter || venter.length === 0) return tom;

  const sakIds = venter.map((s) => s.id as string);

  // Nyeste aktivitet per sak = seneste av (utkast.sendt_at, brev.opprettet).
  const [{ data: utkast }, { data: brev }, { data: alt }] = await Promise.all([
    supabase
      .from("utkast")
      .select("sak_id, sendt_at")
      .in("sak_id", sakIds)
      .not("sendt_at", "is", null),
    supabase.from("brev").select("sak_id, opprettet").in("sak_id", sakIds),
    supabase
      .from("sendte_oppfolginger")
      .select("sak_id")
      .in("sak_id", sakIds),
  ]);

  const sisteAktivitet = new Map<string, string>();
  const oppdater = (id: string, ts: string | null) => {
    if (!ts) return;
    const na = sisteAktivitet.get(id);
    if (!na || ts > na) sisteAktivitet.set(id, ts);
  };
  for (const u of utkast ?? []) oppdater(u.sak_id as string, u.sendt_at as string);
  for (const b of brev ?? []) oppdater(b.sak_id as string, b.opprettet as string);

  const alleredeSendt = new Set((alt ?? []).map((r) => r.sak_id as string));

  const venterSaker: VenterSak[] = venter
    .filter((s) => sisteAktivitet.has(s.id as string))
    .map((s) => ({
      sakId: s.id as string,
      brukerId: s.bruker_id as string,
      kreditor: (s.kreditor as string | null) ?? null,
      sisteAktivitet: sisteAktivitet.get(s.id as string)!,
    }));

  const kandidater = oppfolgingsKandidater(venterSaker, alleredeSendt, new Date());
  if (kandidater.length === 0) return tom;

  // Cache bruker-oppslag (e-post + varsel-preferanse).
  const brukerCache = new Map<
    string,
    { epost: string; varslerPaa: boolean } | null
  >();
  async function hentBruker(id: string) {
    if (brukerCache.has(id)) return brukerCache.get(id)!;
    const { data } = await supabase.auth.admin.getUserById(id);
    const u = data?.user;
    const res = u?.email
      ? { epost: u.email, varslerPaa: u.user_metadata?.varsler_paa !== false }
      : null;
    brukerCache.set(id, res);
    return res;
  }

  let sendt = 0;
  let avmeldt = 0;
  for (const k of kandidater) {
    const bruker = await hentBruker(k.brukerId);
    if (!bruker) continue;
    if (!bruker.varslerPaa) {
      avmeldt++;
      continue;
    }
    if (dryRun) {
      sendt++;
      continue;
    }
    const ok = await sendOppfolging(bruker.epost, k.kreditor);
    if (!ok) continue;
    sendt++;
    await supabase
      .from("sendte_oppfolginger")
      .upsert({ sak_id: k.sakId, bruker_id: k.brukerId }, { onConflict: "sak_id", ignoreDuplicates: true });
  }

  return { kandidater: kandidater.length, sendt, avmeldt };
}

export async function GET(req: NextRequest) {
  // Bare Vercel Cron (eller den som kjenner hemmeligheten) får kjøre dette.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ feil: "CRON_SECRET er ikke satt" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Ikke autorisert", { status: 401 });
  }

  // dryRun beregner hva som ville blitt sendt uten å sende eller logge noe.
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const supabase = createAdminClient();
  const idag = idagOslo();
  const senesteDato = new Date(Date.parse(`${idag}T00:00:00Z`) + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Åpne frister med forfall innen 7 dager (på tvers av alle brukere).
  const { data: frister, error } = await supabase
    .from("frister")
    .select("id, tittel, forfallsdato, bruker_id, saker(tittel)")
    .eq("fullfort", false)
    .gte("forfallsdato", idag)
    .lte("forfallsdato", senesteDato)
    .returns<FristRad[]>();

  if (error) {
    console.error("[cron] Kunne ikke hente frister:", error.message);
    return Response.json({ feil: "Databasefeil" }, { status: 500 });
  }

  // Behold bare frister som treffer en terskel (7, 3 eller 1 dager igjen).
  const kandidater = (frister ?? [])
    .map((f) => ({ ...f, terskel: dagerMellom(idag, f.forfallsdato) }))
    .filter((f) => (TERSKLER as readonly number[]).includes(f.terskel));

  if (kandidater.length === 0) {
    const oppfolging = await kjorOppfolging(supabase, dryRun);
    return Response.json({ dato: idag, kandidater: 0, sendt: 0, oppfolging });
  }

  // Hvilke (frist, terskel) har vi allerede varslet om?
  const { data: alleredeSendt } = await supabase
    .from("sendte_varsler")
    .select("frist_id, terskel")
    .in(
      "frist_id",
      kandidater.map((f) => f.id),
    );
  const sendtSett = new Set(
    (alleredeSendt ?? []).map((r) => `${r.frist_id}:${r.terskel}`),
  );

  const nye = kandidater.filter(
    (f) => !sendtSett.has(`${f.id}:${f.terskel}`),
  );

  // Grupper per bruker slik at hver bruker får én samle-e-post.
  const perBruker = new Map<string, typeof nye>();
  for (const f of nye) {
    const liste = perBruker.get(f.bruker_id) ?? [];
    liste.push(f);
    perBruker.set(f.bruker_id, liste);
  }

  let sendt = 0;
  let hoppetAvmeldt = 0;

  for (const [brukerId, brukerFrister] of perBruker) {
    // Hent e-post og varsel-preferanse for brukeren.
    const { data: brukerData, error: brukerFeil } =
      await supabase.auth.admin.getUserById(brukerId);
    const bruker = brukerData?.user;
    if (brukerFeil || !bruker?.email) continue;

    // Standard: påminnelser er på. Bare eksplisitt false skrur dem av.
    if (bruker.user_metadata?.varsler_paa === false) {
      hoppetAvmeldt++;
      continue;
    }

    const varsler: FristVarsel[] = brukerFrister
      .sort((a, b) => a.forfallsdato.localeCompare(b.forfallsdato))
      .map((f) => ({
        tittel: f.tittel,
        forfallsdato: f.forfallsdato,
        sakTittel: sakTittel(f.saker),
      }));

    if (dryRun) {
      sendt++;
      continue;
    }

    const ok = await sendFristPaaminnelse(bruker.email, varsler);
    if (!ok) continue;
    sendt++;

    // Logg hver varslet (frist, terskel) så vi ikke sender dem på nytt.
    await supabase.from("sendte_varsler").upsert(
      brukerFrister.map((f) => ({
        frist_id: f.id,
        bruker_id: brukerId,
        terskel: f.terskel,
      })),
      { onConflict: "frist_id,terskel", ignoreDuplicates: true },
    );
  }

  const oppfolging = await kjorOppfolging(supabase, dryRun);

  return Response.json({
    dato: idag,
    kandidater: kandidater.length,
    nye: nye.length,
    sendt,
    hoppetAvmeldt,
    oppfolging,
    dryRun,
  });
}
