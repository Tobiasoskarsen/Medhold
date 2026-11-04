"use client";

import { useState } from "react";
import { CircleHelp, FileText, Landmark, Mail, Scale, ShieldCheck } from "lucide-react";
import { Bunnark } from "@/components/ui/Bunnark";
import { SNARVEI_KLASSE } from "@/components/ui/Snarvei";
import { SUPPORT_EPOST } from "@/lib/brand";
import { Rad } from "./meg/Rad";

/**
 * «Få hjelp» på Hjem: et bunnark med appens eksisterende hjelpelenker, så
 * brukeren ikke sendes til toppen av Meg uten sammenheng. Ingen ny
 * hjelpetjeneste — bare de samme lenkene som finnes under Meg og Veier ut.
 */
export function HjelpKnapp({ variant = "snarvei" }: { variant?: "snarvei" | "lenke" }) {
  const [apen, setApen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={apen}
        onClick={() => setApen(true)}
        className={
          variant === "snarvei"
            ? SNARVEI_KLASSE
            : "trykk mx-auto flex min-h-11 items-center gap-1.5 text-hjelp font-medium text-dempet transition hover:text-blekk"
        }
      >
        <CircleHelp
          className={variant === "snarvei" ? "size-5 shrink-0 text-aksent-dyp" : "size-4"}
          strokeWidth={1.75}
          aria-hidden
        />
        Få hjelp
      </button>
      <Bunnark apen={apen} onLukk={() => setApen(false)} tittel="Få hjelp">
        <div className="flex flex-col divide-y divide-strek">
          <Rad ikon={Scale} etikett="Satsene vi bruker" href="/satser" />
          <Rad ikon={FileText} etikett="Alle brev" href="/brev" />
          <Rad
            ikon={Mail}
            etikett="Kontakt support"
            href={`mailto:${SUPPORT_EPOST}?subject=${encodeURIComponent("Hjelp med Medhold")}`}
          />
          <Rad ikon={ShieldCheck} etikett="Personvern og data" href="/personvern" />
          <Rad
            ikon={Landmark}
            etikett="Gratis gjeldsrådgivning hos NAV"
            href="https://www.nav.no/okonomi-gjeld"
          />
        </div>
      </Bunnark>
    </>
  );
}
