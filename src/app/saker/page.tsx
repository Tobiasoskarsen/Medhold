import Link from "next/link";
import {
  Plus,
  CalendarClock,
  LayoutTemplate,
  ArrowRight,
  Sprout,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KategoriMerke, KategoriIkon, StatusMerke } from "@/components/Merker";
import MalListe from "@/components/MalListe";
import { fristNærhet, hastegrad, HASTEGRAD_STIL } from "@/lib/dato";
import {
  STATUS_ETIKETT,
  erStatus,
  type FristMedSak,
  type Sak,
  type SakStatus,
} from "@/lib/types";

type Filter = SakStatus | "alle";

const FILTRE: { verdi: Filter; etikett: string }[] = [
  { verdi: "alle", etikett: "Alle" },
  { verdi: "aktiv", etikett: STATUS_ETIKETT.aktiv },
  { verdi: "venter_pa_svar", etikett: STATUS_ETIKETT.venter_pa_svar },
  { verdi: "fullfort", etikett: STATUS_ETIKETT.fullfort },
];

function formaterDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function datoChip(iso: string): { dag: string; mnd: string } {
  const d = new Date(iso + "T00:00:00");
  return {
    dag: d.toLocaleDateString("nb-NO", { day: "numeric" }),
    mnd: d.toLocaleDateString("nb-NO", { month: "short" }),
  };
}

const HASTEGRAD_TEKST: Record<string, string> = {
  overtid: "text-red-600",
  snart: "text-amber-600",
  senere: "text-slate-900",
};

export default async function SakerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const aktivtFilter: Filter = erStatus(status) ? status : "alle";

  const supabase = await createClient();

  let sakSpørring = supabase
    .from("saker")
    .select("*")
    .order("sist_endret", { ascending: false });
  if (aktivtFilter !== "alle") {
    sakSpørring = sakSpørring.eq("status", aktivtFilter);
  }

  const [
    { data: sakData, error: sakFeil },
    { data: fristData },
    { count: aktiveCount },
    { data: stegData },
  ] = await Promise.all([
    sakSpørring,
    supabase
      .from("frister")
      .select("*, saker(tittel, kategori)")
      .eq("fullfort", false)
      .order("forfallsdato", { ascending: true }),
    supabase
      .from("saker")
      .select("*", { count: "exact", head: true })
      .eq("status", "aktiv"),
    supabase
      .from("neste_steg")
      .select("id, tekst, sak_id, fullfort, saker(tittel)")
      .order("rekkefolge", { ascending: true })
      .order("opprettet", { ascending: true }),
  ]);

  const saker = (sakData ?? []) as Sak[];
  const kommendeFrister = (fristData ?? []) as FristMedSak[];
  const aktive = aktiveCount ?? 0;
  const visOversikt =
    aktive > 0 || kommendeFrister.length > 0 || saker.length > 0;

  type StegRad = {
    id: string;
    tekst: string;
    sak_id: string;
    fullfort: boolean;
    saker: { tittel: string } | null;
  };
  const alleSteg = (stegData ?? []) as unknown as StegRad[];
  const apneSteg = alleSteg.filter((s) => !s.fullfort);

  // Framgang per sak + totalt (til framdriftsstriper og momentum-stripen).
  const stegPerSak = new Map<string, { gjort: number; totalt: number }>();
  for (const s of alleSteg) {
    const p = stegPerSak.get(s.sak_id) ?? { gjort: 0, totalt: 0 };
    p.totalt += 1;
    if (s.fullfort) p.gjort += 1;
    stegPerSak.set(s.sak_id, p);
  }
  const stegGjortTotalt = alleSteg.filter((s) => s.fullfort).length;
  const stegTotalt = alleSteg.length;

  // Hilsen etter tid på døgnet (norsk tid), med valgfritt fornavn.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const timeOslo = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Oslo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const hilsenTid =
    timeOslo < 5
      ? "God natt"
      : timeOslo < 10
        ? "God morgen"
        : timeOslo < 18
          ? "God dag"
          : "God kveld";
  const fornavn = user?.user_metadata?.fornavn as string | undefined;
  const hilsen = fornavn ? `${hilsenTid}, ${fornavn}` : hilsenTid;
  const iDagTekst = (() => {
    const s = new Intl.DateTimeFormat("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Oslo",
    }).format(new Date());
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const nesteFrist = kommendeFrister[0];
  let hvaNa:
    | { tekst: string; sakId: string; sakTittel?: string; frist?: string }
    | null = null;
  if (nesteFrist) {
    const steg = apneSteg.find((s) => s.sak_id === nesteFrist.sak_id);
    hvaNa = {
      tekst: steg ? steg.tekst : `Følg opp: ${nesteFrist.tittel}`,
      sakId: nesteFrist.sak_id,
      sakTittel: nesteFrist.saker?.tittel,
      frist: fristNærhet(nesteFrist.forfallsdato),
    };
  } else if (apneSteg.length > 0) {
    hvaNa = {
      tekst: apneSteg[0].tekst,
      sakId: apneSteg[0].sak_id,
      sakTittel: apneSteg[0].saker?.tittel,
    };
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {hilsen}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {iDagTekst} · ta én ting av gangen
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/saker/mal"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <LayoutTemplate className="size-4" aria-hidden />
            <span className="hidden sm:inline">Bruk en mal</span>
          </Link>
          <Link
            href="/saker/ny"
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="size-4" aria-hidden />
            Ny sak
          </Link>
        </div>
      </div>

      {/* ============ MOMENTUM ============ */}
      {stegTotalt > 0 && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-teal-50/70 px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <Sprout className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-teal-800">
              {stegGjortTotalt > 0
                ? `Du har fullført ${stegGjortTotalt} steg. Hvert steg teller.`
                : "Kom i gang når du er klar — ett lite steg av gangen."}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-100">
              <div
                className="h-full rounded-full bg-teal-500"
                style={{
                  width: `${Math.round((stegGjortTotalt / stegTotalt) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============ HVA NÅ? ============ */}
      {hvaNa && (
        <Link
          href={`/saker/${hvaNa.sakId}`}
          className="mb-8 block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200"
        >
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              Hva nå?
            </span>
            <span className="text-xs text-slate-400">
              det viktigste akkurat nå
            </span>
          </span>
          <p className="mt-2.5 text-lg font-medium text-slate-900">
            {hvaNa.tekst}
          </p>
          {(hvaNa.sakTittel || hvaNa.frist) && (
            <p className="mt-1 text-sm text-slate-500">
              {hvaNa.sakTittel}
              {hvaNa.frist ? ` · ${hvaNa.frist}` : ""}
            </p>
          )}
          <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700">
            Åpne saken
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
      )}

      {/* ============ NØKKELTALL ============ */}
      {visOversikt && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <Nokkeltall etikett="Aktive saker" verdi={String(aktive)} />
          <Nokkeltall
            etikett="Kommende frister"
            verdi={String(kommendeFrister.length)}
          />
          <Nokkeltall
            etikett="Neste frist"
            verdi={
              kommendeFrister.length > 0
                ? fristNærhet(kommendeFrister[0].forfallsdato)
                : "Ingen"
            }
            farge={
              kommendeFrister.length > 0
                ? HASTEGRAD_TEKST[hastegrad(kommendeFrister[0].forfallsdato)]
                : "text-slate-400"
            }
          />
        </div>
      )}

      {/* ============ KOMMENDE FRISTER ============ */}
      {kommendeFrister.length > 0 && (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="size-5 text-teal-600" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">
              Kommende frister
            </h2>
          </div>
          <ul className="flex flex-col">
            {kommendeFrister.map((frist, i) => {
              const { dag, mnd } = datoChip(frist.forfallsdato);
              return (
                <li key={frist.id}>
                  <Link
                    href={`/saker/${frist.sak_id}`}
                    className={`flex items-center gap-4 py-3 transition hover:opacity-70 ${
                      i > 0 ? "border-t border-slate-100" : ""
                    }`}
                  >
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1.5 text-center">
                      <span className="text-base font-semibold leading-none text-slate-900">
                        {dag}
                      </span>
                      <span className="mt-0.5 text-xs text-slate-500">
                        {mnd}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {frist.tittel}
                      </p>
                      {frist.saker && (
                        <p className="truncate text-sm text-slate-500">
                          {frist.saker.tittel}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        HASTEGRAD_STIL[hastegrad(frist.forfallsdato)]
                      }`}
                    >
                      {fristNærhet(frist.forfallsdato)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ============ SAKSLISTE ============ */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {FILTRE.map((f) => {
          const aktiv = f.verdi === aktivtFilter;
          const href =
            f.verdi === "alle" ? "/saker" : `/saker?status=${f.verdi}`;
          return (
            <Link
              key={f.verdi}
              href={href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                aktiv
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.etikett}
            </Link>
          );
        })}
      </nav>

      {sakFeil && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kunne ikke hente saker. Sjekk at databasen er satt opp (kjør
          migrasjonene i Supabase).
        </p>
      )}

      {!sakFeil && saker.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
          {aktivtFilter === "alle" ? (
            <>
              <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <Sprout className="size-6" aria-hidden />
              </span>
              <p className="text-lg font-medium text-slate-900">
                Her begynner oversikten
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                En sak er én tråd i det du står i — for eksempel «Søknad om
                sykepenger» eller «Oppsigelse av bolig». Vi tar det sammen, én
                ting av gangen. Begynn med den som ligger tyngst på deg.
              </p>
              <Link
                href="/saker/ny"
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
              >
                <Plus className="size-4" aria-hidden />
                Opprett din første sak
              </Link>
            </>
          ) : (
            <p className="text-base font-medium text-slate-700">
              Ingen saker med denne statusen ennå.
            </p>
          )}
        </div>
      )}

      {!sakFeil && saker.length === 0 && aktivtFilter === "alle" && (
        <section className="mt-8">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            Eller kom i gang med en mal
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Velg situasjonen som ligner mest på din, så lager vi en sak med
            konkrete neste steg.
          </p>
          <MalListe />
        </section>
      )}

      {saker.length > 0 && (
        <ul className="flex flex-col gap-3">
          {saker.map((sak) => {
            const p = stegPerSak.get(sak.id);
            return (
              <li key={sak.id}>
                <Link
                  href={`/saker/${sak.id}`}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
                >
                  <KategoriIkon kategori={sak.kategori} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-medium text-slate-900">
                        {sak.tittel}
                      </h3>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formaterDato(sak.sist_endret)}
                      </span>
                    </div>
                    {sak.beskrivelse && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                        {sak.beskrivelse}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusMerke status={sak.status} />
                      <KategoriMerke kategori={sak.kategori} />
                    </div>
                    {p && p.totalt > 0 && (
                      <div className="mt-3 flex items-center gap-2.5">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{
                              width: `${Math.round((p.gjort / p.totalt) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {p.gjort} av {p.totalt} steg
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Nokkeltall({
  etikett,
  verdi,
  farge = "text-slate-900",
}: {
  etikett: string;
  verdi: string;
  farge?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-100/70 p-4">
      <p className="text-xs text-slate-500">{etikett}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${farge}`}>
        {verdi}
      </p>
    </div>
  );
}
