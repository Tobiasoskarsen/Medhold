import Link from "next/link";
import { Plus, CalendarClock, LayoutTemplate } from "lucide-react";
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
  ]);

  const saker = (sakData ?? []) as Sak[];
  const kommendeFrister = (fristData ?? []) as FristMedSak[];
  const aktive = aktiveCount ?? 0;
  const visOversikt =
    aktive > 0 || kommendeFrister.length > 0 || saker.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Mine saker
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/saker/mal"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <LayoutTemplate className="size-4" aria-hidden />
            Bruk en mal
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
          <p className="text-base font-medium text-slate-700">
            {aktivtFilter === "alle"
              ? "Du har ingen saker enda."
              : "Ingen saker med denne statusen."}
          </p>
          {aktivtFilter === "alle" && (
            <>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                En sak er én tråd i det du står i — for eksempel «Søknad om
                sykepenger» eller «Oppsigelse av bolig». Begynn med den som
                ligger tyngst på deg.
              </p>
              <Link
                href="/saker/ny"
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="size-4" aria-hidden />
                Opprett din første sak
              </Link>
            </>
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
          {saker.map((sak) => (
            <li key={sak.id}>
              <Link
                href={`/saker/${sak.id}`}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <KategoriIkon kategori={sak.kategori} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-slate-900">{sak.tittel}</h3>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formaterDato(sak.sist_endret)}
                    </span>
                  </div>
                  {sak.beskrivelse && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                      {sak.beskrivelse}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusMerke status={sak.status} />
                    <KategoriMerke kategori={sak.kategori} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
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
