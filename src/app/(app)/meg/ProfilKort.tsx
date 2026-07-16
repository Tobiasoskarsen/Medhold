"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Phone, KeyRound } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";
import { Fornavn } from "./Fornavn";
import { Telefon } from "./Telefon";
import { Gruppe } from "./Gruppe";
import { Rad } from "./Rad";

/**
 * Profilhode + «Rediger profil»-utvidelse + Konto-gruppe. Utvidelsen har to
 * innganger (knappen i hodet OG Telefon-raden) som deler samme åpne-tilstand
 * — derfor bor de i samme klientkomponent.
 */
export function ProfilKort({
  fornavn,
  epost,
  telefon,
  innlogging,
}: {
  fornavn: string;
  epost: string;
  telefon: string;
  innlogging: string;
}) {
  const [rediger, setRediger] = useState(false);
  const initial = (fornavn.trim()[0] ?? epost.trim()[0] ?? "M").toUpperCase();

  return (
    <div>
      <div className="flex flex-col items-center pb-5 pt-3">
        <div className="flex size-16 items-center justify-center rounded-full bg-aksent/10 text-2xl font-medium text-aksent">
          {initial}
        </div>
        {fornavn.trim() && (
          <p className="mt-3 text-[17px] font-medium text-blekk">{fornavn}</p>
        )}
        <p className="mt-0.5 text-[13px] text-dempet">{epost}</p>
        <button
          type="button"
          onClick={() => setRediger((r) => !r)}
          aria-expanded={rediger}
          className="trykk mt-2.5 rounded-full border-[0.5px] border-strek bg-flate px-3.5 py-1.5 text-[13px] font-medium text-blekk"
        >
          Rediger profil
        </button>
      </div>

      <AnimatePresence initial={false}>
        {rediger && (
          <m.div
            key="rediger"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <div className="mb-[18px] flex flex-col gap-4 rounded-2xl border-[0.5px] border-strek bg-flate p-[18px]">
              <Fornavn start={fornavn} />
              <Telefon start={telefon} />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <Gruppe tittel="Konto">
        <Rad
          ikon={Phone}
          etikett="Telefon"
          verdi={telefon.trim() || "Legg til"}
          onClick={() => setRediger((r) => !r)}
        />
        <Rad
          ikon={KeyRound}
          etikett="Innlogging"
          verdi={innlogging}
          chevron={false}
        />
      </Gruppe>
    </div>
  );
}
