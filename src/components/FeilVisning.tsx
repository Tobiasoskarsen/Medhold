"use client";

import type { ReactNode } from "react";
import { NavLenke as Link } from "@/components/NavLenke";
import { Skjermramme, Kort, Primærknapp } from "@/components/ui";

type Primaerhandling =
  | { tekst: string; onClick: () => void; href?: undefined }
  | { tekst: string; href: string; onClick?: undefined };

/**
 * Delt visning for error.tsx/not-found.tsx, i og utenfor (app)-gruppen —
 * samme branded stil, ingen duplisering. `primaer` tar enten en handler
 * (Prøv igjen → reset()) eller en href (Til forsiden). `detalj` vises kun i
 * dev (se error.tsx) — ALDRI lekk tekniske detaljer i produksjon.
 */
export function FeilVisning({
  tittel,
  tekst,
  primaer,
  sekundaer,
  detalj,
}: {
  tittel: string;
  tekst: string;
  primaer: Primaerhandling;
  sekundaer?: { tekst: string; href: string };
  detalj?: string;
}): ReactNode {
  return (
    <Skjermramme className="pt-10">
      <Kort className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-serif text-[22px] font-medium tracking-[-0.01em] text-blekk">
          {tittel}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-dempet">{tekst}</p>

        <div className="mt-5 flex w-full flex-col items-center gap-3">
          {primaer.onClick ? (
            <Primærknapp onClick={primaer.onClick} className="w-full">
              {primaer.tekst}
            </Primærknapp>
          ) : (
            <Primærknapp href={primaer.href} className="w-full">
              {primaer.tekst}
            </Primærknapp>
          )}
          {sekundaer && (
            <Link
              href={sekundaer.href}
              className="text-[13px] text-dempet underline decoration-strek underline-offset-2 hover:text-blekk"
            >
              {sekundaer.tekst}
            </Link>
          )}
        </div>

        {detalj && (
          <p className="mt-4 w-full overflow-x-auto rounded-lg bg-bakgrunn p-2 text-left font-mono text-[11px] text-dempet">
            {detalj}
          </p>
        )}
      </Kort>
    </Skjermramme>
  );
}
