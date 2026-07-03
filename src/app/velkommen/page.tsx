"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  ListChecks,
  Languages,
  LayoutTemplate,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Steg = { ikon: LucideIcon; tittel: string; tekst: string };

const STEG: Steg[] = [
  {
    ikon: Compass,
    tittel: "Velkommen til Klarvei",
    tekst:
      "Når livet blir vanskelig, drukner man fort i brev, frister og «hva må jeg gjøre nå». Klarvei hjelper deg å holde oversikt — én ting av gangen.",
  },
  {
    ikon: ListChecks,
    tittel: "Samle sakene dine",
    tekst:
      "Lag en sak for hver tråd du står i — for eksempel sykepenger, bolig eller gjeld. Legg inn frister og neste steg, så ser du alltid hva som haster.",
  },
  {
    ikon: Languages,
    tittel: "Forstå brevene",
    tekst:
      "Lim inn et brev fra NAV eller andre, så forklarer vi hva det betyr på enkelt norsk — og kan oversette det til ditt språk. Du kan stille oppfølgingsspørsmål også.",
  },
  {
    ikon: LayoutTemplate,
    tittel: "Vet du ikke hvor du skal begynne?",
    tekst:
      "Velg en situasjon — sykdom, gjeld, samlivsbrudd eller dødsfall — så lager vi en sak med konkrete neste steg for deg. Du kan endre alt etterpå.",
  },
];

export default function VelkommenPage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [navn, setNavn] = useState("");
  const [laster, setLaster] = useState(false);

  // Etter de fire intro-stegene kommer en valgfri navne-skjerm.
  const antallSteg = STEG.length + 1;
  const paNavn = i === STEG.length;
  const sisteSteg = paNavn;
  const steg = STEG[i];
  const Ikon = steg?.ikon;

  async function fullfor() {
    setLaster(true);
    const supabase = createClient();
    const data: Record<string, unknown> = { onboardet: true };
    if (navn.trim()) data.fornavn = navn.trim();
    await supabase.auth.updateUser({ data });
    router.push("/saker");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center gap-1.5">
          {Array.from({ length: antallSteg }).map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-6 bg-teal-600" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {paNavn ? (
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
              Så vi kan hilse deg riktig
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Hva vil du at vi skal kalle deg? Det er helt valgfritt, og du kan
              endre det senere.
            </p>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fullfor();
              }}
              placeholder="Fornavn"
              maxLength={40}
              autoFocus
              className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              {Ikon && <Ikon className="size-7" aria-hidden />}
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
              {steg.tittel}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {steg.tekst}
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {i > 0 ? (
            <button
              type="button"
              onClick={() => setI((n) => n - 1)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
            >
              Tilbake
            </button>
          ) : (
            <button
              type="button"
              onClick={fullfor}
              disabled={laster}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
            >
              Hopp over
            </button>
          )}

          {sisteSteg ? (
            <button
              type="button"
              onClick={fullfor}
              disabled={laster}
              className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {laster ? "Et øyeblikk …" : "Kom i gang"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setI((n) => n + 1)}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Neste
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
