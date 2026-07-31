// Alvorsvarsel (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §B.4) — vises MED
// FORRANG over Veivalg når nyeste brev er vurdert alvorlig (erAlvorligSak).
// Medhold er bygget for vanlige inkassosaker, ikke saker på randen av
// konkurs/tvangssalg — her henviser appen videre i stedet for å tilby et
// generert svarbrev. Ingen ny farge (gjenbruker dom-rod/dom-rod-bg).
import { Scale, Gavel, LifeBuoy } from "lucide-react";
import type { ReactNode } from "react";

function HjelpeLenke({
  ikon,
  tittel,
  tekst,
  href,
}: {
  ikon: ReactNode;
  tittel: string;
  tekst: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="trykk flex items-center gap-3 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-3"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dom-rod/10 text-dom-rod">
        {ikon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-blekk">{tittel}</span>
        <span className="block text-[12px] text-dempet">{tekst}</span>
      </span>
    </a>
  );
}

export function Alvorsvarsel({
  signalord,
  className = "",
}: {
  /** Signalordet som faktisk ble funnet i brevet (erAlvorligSak/finnFraser) —
   *  aldri en fast setning som kan bomme på hva brevet faktisk nevner. */
  signalord: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-[1.5px] border-dom-rod bg-dom-rod-bg p-[18px] ${className}`}
    >
      <h2 className="font-serif text-[17px] font-semibold text-dom-rod">
        Dette bør du få hjelp med nå
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-blekk">
        Dette brevet nevner {signalord}. Medhold er bygget for vanlige
        inkassosaker — her bør du snakke med noen som kan hjelpe deg videre.
        Det er gratis.
      </p>

      <div className="mt-3.5 flex flex-col gap-2">
        <HjelpeLenke
          ikon={<Scale className="size-4" aria-hidden />}
          tittel="Jussbuss"
          tekst="Gratis rettshjelp i gjeldssaker"
          href="https://jussbuss.no"
        />
        <HjelpeLenke
          ikon={<Gavel className="size-4" aria-hidden />}
          tittel="Advokatvakten"
          tekst="30 minutter gratis hos en advokat"
          href="https://www.advokatenhjelperdeg.no/advokatvakten/"
        />
        <HjelpeLenke
          ikon={<LifeBuoy className="size-4" aria-hidden />}
          tittel="NAVs gjeldsrådgivning"
          tekst="Gratis økonomisk rådgivning"
          href="https://www.nav.no/okonomi-gjeld"
        />
      </div>

      <p className="mt-3.5 text-[12px] leading-relaxed text-dempet">
        Fristene og oversikten over saken fungerer som vanlig — det er kun
        forslag til svar vi ikke tilbyr her.
      </p>
    </div>
  );
}
