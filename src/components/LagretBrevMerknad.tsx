import { NavLenke as Link } from "./NavLenke";
import { formaterDato } from "@/lib/dato";

/** Kallestedet må først finne brevet i den autentiserte saksspørringen. */
export function LagretBrevMerknad({ sakId, brevId, saksnavn, frister }: {
  sakId: string; brevId: string; saksnavn?: string;
  frister?: { tittel: string; forfallsdato: string }[];
}) {
  return (
    <div role="status" className="mb-4 rounded-kontroll border border-strek bg-flate p-4 text-hjelp text-blekk">
      <p>Brevet er lagret i saken. Du kan komme tilbake når du vil. Ingenting er sendt.</p>
      {saksnavn && <p className="mt-2 break-words font-semibold">Sak: {saksnavn}</p>}
      {frister && (frister.length ? <ul className="mt-1 space-y-1">{frister.map((f, i) => <li key={i} className="break-words">Lagret frist: {f.tittel} · {formaterDato(f.forfallsdato)}</li>)}</ul> : <p className="mt-1">Ingen frister er lagret med dette brevet.</p>)}
      <Link href={`/krav/${sakId}/brev/${brevId}`} className="mt-1 inline-flex min-h-11 items-center font-semibold text-aksent underline">Åpne det lagrede brevet</Link>
    </div>
  );
}
