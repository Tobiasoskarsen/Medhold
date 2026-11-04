import { STADIUM_ETIKETT, type Stadium } from "@/lib/gjeld";

/**
 * StadiumLinje — det registrerte stadiet som en rolig etikett. Erstatter den
 * fremdriftslignende firetrinnslinjen (redesign-ordren §2B): ikke alle saker
 * følger én obligatorisk prosess, så visningen sier bare hva saken er
 * registrert som. Stadiumlogikken i lib/gjeld.ts er uendret.
 */
export function StadiumLinje({
  stadium,
  className = "",
}: {
  stadium: Stadium;
  className?: string;
}) {
  const tekst = STADIUM_ETIKETT[stadium];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-flate-2 px-2.5 py-1 text-meta font-semibold text-blekk ${className}`}
    >
      <span className="size-1.5 rounded-full bg-aksent" aria-hidden />
      {tekst.charAt(0).toUpperCase() + tekst.slice(1)}
    </span>
  );
}
