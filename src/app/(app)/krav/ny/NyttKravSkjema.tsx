"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Primærknapp } from "@/components/ui";
import { STADIER, STADIUM_ETIKETT } from "@/lib/gjeld";
import { haptikk } from "@/lib/haptikk";
import { opprettKrav } from "../actions";

const feltKlasse =
  "mt-1.5 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-2.5 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

// «avsluttet» tilbys ikke — et nytt krav er alltid aktivt (bruk løst-flyten
// på krav-detaljen for å avslutte).
const VALGBARE_STADIER = STADIER.filter((s) => s !== "avsluttet");

export function NyttKravSkjema() {
  const router = useRouter();
  const [kreditor, setKreditor] = useState("");
  const [belop, setBelop] = useState("");
  const [saksnummer, setSaksnummer] = useState("");
  const [stadium, setStadium] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function lagre() {
    if (lagrer || !kreditor.trim()) return;
    setLagrer(true);
    setFeil(null);
    const r = await opprettKrav({ kreditor, belop, saksnummer, stadium });
    if (!r.ok) {
      setFeil(r.feil);
      setLagrer(false);
      return;
    }
    haptikk("suksess");
    router.push(`/krav/${r.sakId}`);
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="block text-[13px] font-medium text-blekk">
        Hvem kravet er fra
        <input
          type="text"
          value={kreditor}
          onChange={(e) => setKreditor(e.target.value)}
          placeholder="F.eks. Kredinor"
          className={feltKlasse}
        />
      </label>
      <label className="block text-[13px] font-medium text-blekk">
        Beløp (kr)
        <input
          type="text"
          inputMode="numeric"
          value={belop}
          onChange={(e) => setBelop(e.target.value)}
          placeholder="Valgfritt"
          className={feltKlasse}
        />
      </label>
      <label className="block text-[13px] font-medium text-blekk">
        Saksnummer
        <input
          type="text"
          value={saksnummer}
          onChange={(e) => setSaksnummer(e.target.value)}
          placeholder="Valgfritt"
          className={feltKlasse}
        />
      </label>
      <label className="block text-[13px] font-medium text-blekk">
        Hvor er saken nå?
        <select
          value={stadium}
          onChange={(e) => setStadium(e.target.value)}
          className={feltKlasse}
        >
          <option value="">Velg … (valgfritt)</option>
          {VALGBARE_STADIER.map((s) => (
            <option key={s} value={s}>
              {STADIUM_ETIKETT[s].charAt(0).toUpperCase() +
                STADIUM_ETIKETT[s].slice(1)}
            </option>
          ))}
        </select>
      </label>

      {feil && <p className="text-[13px] text-red-700">{feil}</p>}

      <Primærknapp onClick={lagre} disabled={lagrer || !kreditor.trim()}>
        {lagrer ? "Oppretter …" : "Opprett krav"}
      </Primærknapp>
    </div>
  );
}
