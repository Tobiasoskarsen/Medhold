import { TRAPP_ETIKETTER, trappTrinn, type Stadium } from "@/lib/gjeld";
import { Fremgangsring } from "./Fremgangsring";

/**
 * StadiumRing — bento-tile-versjon av Trapp (designretning 2, sak-detalj):
 * samme fire trinn (Varsel → Oppfordring → Forliksråd → Namsmann) som en
 * fylt sirkel i stedet for stigende søyler. Brukes KUN på sak-detalj —
 * Trapp selv er uendret og fortsatt appens motiv på Hjem/saksliste.
 */
export function StadiumRing({
  stadium,
  className = "",
}: {
  stadium: Stadium;
  className?: string;
}) {
  const naa = trappTrinn(stadium);
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border-[0.5px] border-strek bg-flate p-4 text-center ${className}`}
    >
      <Fremgangsring fraction={naa / TRAPP_ETIKETTER.length} size={58} strokeWidth={7}>
        <span className="font-serif text-[15px] font-semibold tabular-nums text-blekk">
          {naa}/{TRAPP_ETIKETTER.length}
        </span>
      </Fremgangsring>
      <p className="mt-1.5 text-[11px] font-semibold text-aksent-dyp">
        Steg {naa} av {TRAPP_ETIKETTER.length}
      </p>
      <p className="text-[10.5px] text-dempet">{TRAPP_ETIKETTER[naa - 1]}</p>
    </div>
  );
}
