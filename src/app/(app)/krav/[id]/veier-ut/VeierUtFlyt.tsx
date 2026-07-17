"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Kort, Pill } from "@/components/ui";
import { haptikk } from "@/lib/haptikk";
import { formaterBelop } from "@/lib/format";
import { beregnAvdrag } from "@/lib/avdrag";
import { markerLost } from "../../actions";

const knapp =
  "trykk block w-full rounded-[10px] bg-aksent px-3 py-3 text-center text-sm font-medium text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 disabled:opacity-60";

export function VeierUtFlyt({
  sakId,
  brevId,
  total,
}: {
  sakId: string;
  brevId: string | null;
  total: number | null;
}) {
  const router = useRouter();
  const brevQuery = brevId ? `&brev=${brevId}` : "";

  // Kort 1 — betal alt.
  const [betaltBekreft, setBetaltBekreft] = useState(false);
  const [lagrer, startLagre] = useTransition();

  function jegHarBetalt() {
    startLagre(async () => {
      await markerLost(sakId, "oppgjort");
      try {
        sessionStorage.setItem(`medhold-lost-nettopp-${sakId}`, "1");
      } catch {
        /* ignorer */
      }
      haptikk("suksess");
      router.push(`/krav/${sakId}`);
      router.refresh();
    });
  }

  // Kort 2 — avdrag.
  const [manedInput, setManedInput] = useState("");
  const manedsbelop = useMemo(() => {
    const n = Number(manedInput.replace(/\s/g, ""));
    return manedInput.trim() && !Number.isNaN(n) ? n : null;
  }, [manedInput]);
  const forslag =
    total != null && total > 0 && manedsbelop != null && manedsbelop >= 1
      ? beregnAvdrag(total, manedsbelop)
      : null;

  function lagAvtaleForslag() {
    if (!forslag) return;
    haptikk("lett");
    router.push(
      `/krav/${sakId}/utkast?type=nedbetalingsavtale${brevQuery}&manedsbelop=${forslag.manedsbelop}`,
    );
  }

  const feltKlasse =
    "mt-2 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-2.5 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

  return (
    <div className="mt-6 flex flex-col gap-3.5">
      {/* 1 — Betal alt nå */}
      <Kort>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-blekk">Betal alt nå</p>
          <Pill variant="suksess">Billigst</Pill>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
          Stopper alle videre omkostninger. Når hele beløpet er betalt, avsluttes
          saken, og det registreres ingen betalingsanmerkning for dette kravet.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-dempet">
          Betal til kontonummeret som står i brevet —{" "}
          <span className="font-medium text-blekk">aldri til noen andre</span>.
        </p>

        {betaltBekreft ? (
          <div className="mt-3 rounded-xl border-[0.5px] border-strek bg-bakgrunn p-3.5">
            <p className="text-[13px] font-medium text-blekk">
              Har du betalt hele beløpet til kontonummeret i brevet?
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={lagrer}
                onClick={jegHarBetalt}
                className={`${knapp} w-auto px-4 py-2.5`}
              >
                {lagrer ? "Lagrer …" : "Ja, betalt"}
              </button>
              <button
                type="button"
                onClick={() => setBetaltBekreft(false)}
                className="text-[13px] text-dempet transition hover:text-blekk"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setBetaltBekreft(true)}
            className={`${knapp} mt-3.5`}
          >
            Jeg har betalt
          </button>
        )}
      </Kort>

      {/* 2 — Nedbetalingsavtale */}
      <Kort>
        <p className="text-[15px] font-semibold text-blekk">
          Foreslå nedbetalingsavtale
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
          Del beløpet opp i avdrag over tid. Skriv hva du klarer i måneden, så
          regner vi ut planen.
        </p>

        <label className="mt-3 block text-[13px] font-medium text-blekk">
          Hva klarer du å betale i måneden?
          <input
            type="text"
            inputMode="numeric"
            value={manedInput}
            onChange={(e) => setManedInput(e.target.value)}
            placeholder="F.eks. 500"
            className={feltKlasse}
          />
        </label>

        {forslag && (
          <div className="mt-3 rounded-xl bg-aksent/5 px-3.5 py-3">
            <p className="text-sm text-blekk">
              <span className="font-serif text-[19px] font-semibold tabular-nums">
                {formaterBelop(forslag.manedsbelop)} kr/mnd
              </span>{" "}
              i {forslag.antallMandeder}{" "}
              {forslag.antallMandeder === 1 ? "måned" : "måneder"}
              {forslag.sisteAvdrag !== forslag.manedsbelop
                ? ` (siste avdrag ${formaterBelop(forslag.sisteAvdrag)} kr)`
                : ""}
              .
            </p>
            {forslag.antallMandeder > 12 && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-dempet">
                Lange avtaler blir sjeldnere akseptert — vurder et høyere
                månedsbeløp hvis du kan.
              </p>
            )}
          </div>
        )}

        {total == null && (
          <p className="mt-2 text-[12px] text-dempet">
            Legg inn totalbeløpet på kravet for å regne ut en plan.
          </p>
        )}

        <p className="mt-3 text-[12px] leading-relaxed text-dempet">
          En avdragsordning kan gi noe ekstra omkostninger og renter frem til alt
          er betalt.
        </p>

        <button
          type="button"
          disabled={!forslag}
          onClick={lagAvtaleForslag}
          className={`${knapp} mt-3.5`}
        >
          Lag forslaget
        </button>
      </Kort>

      {/* 3 — Betalingsutsettelse */}
      <Kort>
        <p className="text-[15px] font-semibold text-blekk">
          Be om betalingsutsettelse
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
          Be om å utsette betalingen til en bestemt dato. Beløpet endres ikke — du
          kjøper tid.
        </p>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/krav/${sakId}/utkast?type=betalingsutsettelse${brevQuery}`,
            )
          }
          className={`${knapp} mt-3.5`}
        >
          Skriv anmodningen
        </button>
      </Kort>

      <p className="mt-2 text-center text-[12px] leading-relaxed text-dempet">
        Trenger du hjelp med helheten i økonomien?{" "}
        <a
          href="https://www.nav.no/okonomi-gjeld"
          target="_blank"
          rel="noopener noreferrer"
          className="text-aksent underline decoration-strek underline-offset-2 hover:decoration-aksent"
        >
          NAV tilbyr gratis gjeldsrådgivning.
        </a>
      </p>
    </div>
  );
}
