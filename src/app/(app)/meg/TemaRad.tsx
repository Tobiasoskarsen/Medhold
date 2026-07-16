"use client";

import { useEffect, useState } from "react";
import { SunMoon } from "lucide-react";
import { Utvidbar } from "./Utvidbar";
import { TemaVelger, NOKKEL, type Tema } from "./Tema";

const ETIKETT: Record<Tema, string> = {
  lys: "Lys",
  mork: "Mørk",
  system: "System",
};

/** «Tema»-rad: viser nåværende valg og ekspanderer til den eksisterende
 *  TemaVelger. SSR-fallback «System» (localStorage finnes ikke ved SSR). */
export function TemaRad() {
  const [tema, setTema] = useState<Tema>("system");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTema((localStorage.getItem(NOKKEL) as Tema | null) ?? "system");
    } catch {
      /* ignorer */
    }
  }, []);

  return (
    <Utvidbar ikon={SunMoon} etikett="Tema" verdi={ETIKETT[tema]}>
      <TemaVelger onEndring={setTema} />
    </Utvidbar>
  );
}
