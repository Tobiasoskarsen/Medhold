import { NavLenke as Link } from "./NavLenke";

/** Kallestedet må først finne brevet i den autentiserte saksspørringen. */
export function LagretBrevMerknad({ sakId, brevId }: { sakId: string; brevId: string }) {
  return (
    <div role="status" className="mb-4 rounded-kontroll border border-strek bg-flate p-4 text-hjelp text-blekk">
      <p>Brevet er lagret i saken. Du kan komme tilbake når du vil. Ingenting er sendt.</p>
      <Link href={`/krav/${sakId}/brev/${brevId}`} className="mt-1 inline-flex min-h-11 items-center font-semibold text-aksent underline">Åpne det lagrede brevet</Link>
    </div>
  );
}
