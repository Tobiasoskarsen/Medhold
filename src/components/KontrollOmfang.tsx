import { FORBEHOLD } from "@/lib/brand";
import { fristKontrollStottes, FRIST_IKKE_KONTROLLERT, FRIST_OMFANG, GEBYR_OMFANG, VARSEL_OMFANG } from "@/lib/kontrollomfang";

/** Forbeholdet og «Hva er kontrollert?». Skjermene som viser denne, har ikke andre forbehold. */

export function KontrollOmfang({ brevtype }: { brevtype: string | null }) {
  return <div className="mt-3 space-y-2 text-hjelp leading-relaxed text-dempet">
    <p className="text-meta text-dempet">
      {!fristKontrollStottes(brevtype) && <>{FRIST_IKKE_KONTROLLERT} </>}
      {FORBEHOLD}
    </p>
    <details className="detaljrad"><summary className="trykk font-medium">Hva er kontrollert?</summary>
      <p>{GEBYR_OMFANG}</p>
      <p className="mt-2">{FRIST_OMFANG}</p>
      <p className="mt-2">{VARSEL_OMFANG}</p>
    </details>
  </div>;
}
