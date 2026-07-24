"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Primærknapp } from "@/components/ui";
import { STEG_GLID } from "@/lib/bevegelse";
import { haptikk } from "@/lib/haptikk";
import { BrevSteg } from "./steg/BrevSteg";
import { TrappSteg } from "./steg/TrappSteg";
import { DomSteg } from "./steg/DomSteg";
import { VeierSteg } from "./steg/VeierSteg";

// Kun til å hoppe over onboardingen ved senere besøk PÅ SAMME ENHET — ikke en
// garantimekanisme (server-flagget user_metadata.har_sett_onboarding, satt
// etter vellykket innlogging, er den ekte kilden — se auth/callback+confirm).
const ONBOARDING_NOKKEL = "medhold-onboarding-sett";

const STEG = [BrevSteg, TrappSteg, DomSteg, VeierSteg];
const SISTE = STEG.length - 1;

function lesOnboardingSett(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_NOKKEL) === "1";
  } catch {
    return false;
  }
}

export function Onboarding() {
  const router = useRouter();
  const redusert = useReducedMotion();
  // Ukjent til etter mount. localStorage finnes ikke ved SSR — å lese den i
  // useState-initialisereren gir ulik server-/klient-hydrering når nøkkelen
  // ER satt (server tegner introen, klienten forventer null), noe som
  // knekker hydreringen: introen fryser (ingen event-handlere festes) og
  // ligger igjen over logg-inn-skjermen etter redirect.
  const [hoppOverAlt, setHoppOverAlt] = useState<boolean | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoppOverAlt(lesOnboardingSett());
  }, []);

  // Sett på nytt besøk, samme enhet, ikke logget inn: hopp rett til logg inn
  // uten å blitze steg 1 først.
  useEffect(() => {
    if (hoppOverAlt === true) router.replace("/logg-inn");
  }, [hoppOverAlt, router]);

  function gaTil(idx: number) {
    haptikk("lett");
    setI(Math.max(0, Math.min(SISTE, idx)));
  }

  function neste() {
    if (i < SISTE) gaTil(i + 1);
    else fullfor();
  }

  function fullfor() {
    try {
      localStorage.setItem(ONBOARDING_NOKKEL, "1");
    } catch {
      /* privat modus e.l. — ignorer */
    }
    haptikk("lett");
    router.push("/logg-inn");
  }

  // Samme markup på server og klient inntil avgjørelsen er tatt (null) eller
  // vi omdirigerer bort (true) — en tom, bakgrunnsfarget flate. Unngår at
  // server og klientens første render noensinne kan avvike strukturelt.
  if (hoppOverAlt !== false) return <main className="min-h-screen bg-bakgrunn" />;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[420px] flex-col">
      {i < SISTE && (
        <button
          type="button"
          onClick={() => gaTil(SISTE)}
          className="absolute right-5 top-5 z-10 text-[13px] font-medium text-dempet"
        >
          Hopp over
        </button>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {STEG.map((StegKomponent, idx) => {
          const posisjon = idx === i ? "aktiv" : idx < i ? "forlater" : "venter";
          const style: CSSProperties = {
            opacity: posisjon === "aktiv" ? 1 : 0,
            transform: redusert
              ? undefined
              : `translateX(${
                  posisjon === "forlater"
                    ? -STEG_GLID
                    : posisjon === "venter"
                      ? STEG_GLID
                      : 0
                }px)`,
            pointerEvents: posisjon === "aktiv" ? "auto" : "none",
            transitionProperty: "opacity, transform",
            transitionDuration: "var(--bevegelse-normal)",
            transitionTimingFunction: "var(--bevegelse-easing)",
          };
          return (
            <div
              key={idx}
              className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
              style={style}
              aria-hidden={posisjon !== "aktiv"}
            >
              <StegKomponent />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 px-6 pb-8 pt-4">
        <div className="flex justify-center gap-1.5" role="tablist">
          {STEG.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-label={`Gå til steg ${idx + 1}`}
              aria-selected={idx === i}
              onClick={() => gaTil(idx)}
              className="h-[7px] rounded-full"
              style={{
                width: idx === i ? 20 : 7,
                backgroundColor: idx === i ? "var(--aksent)" : "var(--strek)",
                transitionProperty: "width, background-color",
                transitionDuration: "var(--bevegelse-normal)",
                transitionTimingFunction: "var(--bevegelse-easing)",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {i > 0 && (
            <button
              type="button"
              onClick={() => gaTil(i - 1)}
              aria-label="Tilbake"
              className="trykk flex size-[52px] shrink-0 items-center justify-center rounded-xl border-[0.5px] border-strek bg-flate text-[15px] font-semibold text-blekk"
            >
              ‹
            </button>
          )}
          <div className="flex-1">
            <Primærknapp onClick={neste}>
              {i === SISTE ? "Kom i gang" : "Neste"}
            </Primærknapp>
          </div>
        </div>
      </div>
    </main>
  );
}
