"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { haptikk } from "@/lib/haptikk";

export type Tema = "lys" | "mork" | "system";
export const NOKKEL = "medhold-tema";

function bruk(t: Tema) {
  const mork =
    t === "mork" ||
    (t === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("mork", mork);
}

const VALG: { verdi: Tema; etikett: string; Ikon: LucideIcon }[] = [
  { verdi: "lys", etikett: "Lys", Ikon: Sun },
  { verdi: "mork", etikett: "Mørk", Ikon: Moon },
  { verdi: "system", etikett: "System", Ikon: Monitor },
];

export function TemaVelger({
  onEndring,
}: {
  onEndring?: (t: Tema) => void;
}) {
  const [tema, setTema] = useState<Tema>("system");

  // Les lagret valg først på klienten (localStorage finnes ikke ved SSR).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTema((localStorage.getItem(NOKKEL) as Tema | null) ?? "system");
    } catch {
      /* ignorer */
    }
  }, []);

  // Følg OS-endringer mens «system» er valgt.
  useEffect(() => {
    if (tema !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const påEndring = () => bruk("system");
    mq.addEventListener("change", påEndring);
    return () => mq.removeEventListener("change", påEndring);
  }, [tema]);

  function velg(t: Tema) {
    setTema(t);
    onEndring?.(t);
    try {
      localStorage.setItem(NOKKEL, t);
    } catch {
      /* ignorer */
    }
    bruk(t);
    haptikk("lett");
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
      {VALG.map(({ verdi, etikett, Ikon }) => {
        const aktiv = tema === verdi;
        return (
          <button
            key={verdi}
            type="button"
            role="radio"
            aria-checked={aktiv}
            onClick={() => velg(verdi)}
            className={`trykk flex flex-col items-center gap-1.5 rounded-xl border-[0.5px] px-2 py-3 text-[13px] font-medium ${
              aktiv
                ? "border-aksent bg-aksent/5 text-blekk"
                : "border-strek text-dempet"
            }`}
          >
            <Ikon className="size-5" aria-hidden />
            {etikett}
          </button>
        );
      })}
    </div>
  );
}
