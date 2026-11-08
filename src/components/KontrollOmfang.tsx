import { fristKontrollStottes, FRIST_IKKE_KONTROLLERT, GEBYR_OMFANG } from "@/lib/kontrollomfang";

export function KontrollOmfang({ brevtype }: { brevtype: string | null }) {
  return <div className="mt-3 space-y-2 text-hjelp leading-relaxed text-dempet">
    {!fristKontrollStottes(brevtype) && <p>{FRIST_IKKE_KONTROLLERT}</p>}
    <details><summary className="trykk min-h-11 cursor-pointer py-2">Hva er kontrollert?</summary>
      <p>{GEBYR_OMFANG}</p>
      <p className="mt-2">Fristkontrollen gjelder bare støttede brevtyper og registrerte datoer. Den avgjør ikke om kravet er gyldig.</p>
      <p className="mt-2">Alvorlighetsvarselet dekker utvalgte signaler. Fravær av varsel er ikke en bekreftelse på at saken er uproblematisk.</p>
    </details>
  </div>;
}
