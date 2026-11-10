import { Check, ArrowRight } from "lucide-react";

/** Vises utelukkende etter et bekreftet serversvar, også mens ruteren laster. */
export function LagretBrev({ sakId, brevId, maal, navigasjonsfeil }: {
  sakId: string; brevId: string; maal: string; navigasjonsfeil: boolean;
}) {
  return (
    <section className="mt-5 rounded-kort border border-kant bg-flate p-5" aria-labelledby="brev-lagret-tittel">
      <Check className="mb-3 size-6 text-aksent" aria-hidden />
      <h1 id="brev-lagret-tittel" className="tittel-s text-blekk">Brevet er lagret</h1>
      <p role="status" className="mt-3 text-hjelp text-dempet">Brevet er lagret i saken. Du finner det igjen under Saker og i sakens historikk. Ingenting er sendt.</p>
      {navigasjonsfeil && <p role="alert" className="mt-3 text-hjelp text-dom-rod">Kunne ikke åpne neste side. Brevet er allerede lagret. Bruk lenkene nedenfor når nettet fungerer igjen.</p>}
      {/* Vanlige lenker gir en full sidelasting hvis klientruteren svikter. */}
      <a href={maal} className="trykk mt-5 flex min-h-[52px] items-center justify-center gap-2 rounded-kontroll bg-knapp px-4 py-3 font-bold text-knapp-tekst focus-visible:outline-2 focus-visible:outline-aksent">Fortsett <ArrowRight className="size-4" aria-hidden /></a>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <a href={`/krav/${sakId}`} className="inline-flex min-h-11 items-center rounded-liten text-hjelp font-semibold text-aksent underline focus-visible:outline-2 focus-visible:outline-aksent">Åpne saken</a>
        <a href={`/krav/${sakId}/brev/${brevId}`} className="inline-flex min-h-11 items-center rounded-liten text-hjelp font-semibold text-aksent underline focus-visible:outline-2 focus-visible:outline-aksent">Åpne brevet</a>
      </div>
    </section>
  );
}
