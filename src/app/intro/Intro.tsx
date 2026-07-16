"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, CalendarClock, PenLine, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Primærknapp } from "@/components/ui";

type Steg = { ikon: LucideIcon; tittel: string; tekst: string };

const STEG: Steg[] = [
  {
    ikon: FileText,
    tittel: "Samle brevene på ett sted",
    tekst:
      "Legg inn inkasso- og kravbrev — Medhold forklarer hva de betyr, på enkelt norsk.",
  },
  {
    ikon: CalendarClock,
    tittel: "Aldri glem en frist",
    tekst:
      "Vi regner ut fristene og minner deg på dem i god tid, så du rekker å svare.",
  },
  {
    ikon: PenLine,
    tittel: "Få hjelp til å svare",
    tekst:
      "Trenger du å svare? Vi lager et utkast du kan endre og sende selv.",
  },
];

export function Intro() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [venter, startTransition] = useTransition();
  const steg = STEG[i];
  const Ikon = steg.ikon;
  const siste = i === STEG.length - 1;

  function fullfor() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { sett_intro: true } });
      router.push("/");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 pt-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={fullfor}
          disabled={venter}
          className="text-[13px] text-dempet transition hover:text-blekk disabled:opacity-50"
        >
          Hopp over
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-aksent/10 text-aksent">
          <Ikon className="size-7" aria-hidden />
        </span>
        <h1 className="mt-6 font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
          {steg.tittel}
        </h1>
        <p className="mt-2.5 text-sm leading-[1.55] text-dempet">{steg.tekst}</p>
      </div>

      <div className="pb-10">
        <div className="mb-6 flex justify-center gap-1.5">
          {STEG.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-6 bg-aksent" : "w-1.5 bg-strek"
              }`}
            />
          ))}
        </div>
        <Primærknapp
          onClick={() => (siste ? fullfor() : setI((n) => n + 1))}
          disabled={venter}
        >
          {siste ? "Kom i gang" : "Neste"}
        </Primærknapp>
      </div>
    </main>
  );
}
