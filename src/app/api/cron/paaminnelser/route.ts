import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFristPaaminnelse, type FristVarsel } from "@/lib/epost";

// Kjøres av Vercel Cron én gang i døgnet (se vercel.json). Kan ta litt tid hvis
// mange e-poster skal ut — gi den rom slik at den ikke kuttes av timeouten.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Hvor mange dager før forfall vi sender påminnelse. Gir opptil tre rolige nudge
// per frist. Én rad i sendte_varsler per (frist, terskel) hindrer duplikater.
const TERSKLER = [7, 3, 1] as const;

/** Dagens dato i norsk tidssone som YYYY-MM-DD (en-CA gir ISO-format). */
function idagOslo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
    return Response.json({ dato: idag, kandidater: 0, sendt: 0 });
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

  return Response.json({
    dato: idag,
    kandidater: kandidater.length,
    nye: nye.length,
    sendt,
    hoppetAvmeldt,
    dryRun,
  });
}
