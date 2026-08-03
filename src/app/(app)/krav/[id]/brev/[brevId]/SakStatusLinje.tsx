import { NavLenke as Link } from "@/components/NavLenke";
import {
  UTFALL_ETIKETT,
  UTFALL_STIL,
  type SakStatus,
  type SakUtfall,
} from "@/lib/types";

/** Henter kun tekstfargen fra en pill-stil (UTFALL_STIL) — samme fargekilde
 *  som pillene, uten bakgrunn/ring (dette er en tekstlinje, ikke en pill). */
function tekstFarge(stilKlasser: string): string {
  return (
    stilKlasser.split(" ").find((c) => c.startsWith("text-")) ?? "text-blekk"
  );
}

/**
 * Statuslinje øverst på brevsiden (MEDHOLD_SAKSTATUS_SYNLIG_ARBEIDSORDRE §3)
 * — ren visning, ingen handling utover lenken til krav-siden. Selve
 * utfallsregistreringen skjer kun der (guardrail 5).
 */
export function SakStatusLinje({
  sakId,
  status,
  utfall,
  navn,
}: {
  sakId: string;
  status: SakStatus;
  utfall: SakUtfall | null;
  navn: string;
}) {
  if (status !== "venter_pa_svar" && status !== "fullfort") return null;

  const tekst =
    status === "venter_pa_svar"
      ? `Du har svart på dette. Venter på svar fra ${navn}.`
      : utfall
        ? `Saken er avsluttet: ${UTFALL_ETIKETT[utfall]}.`
        : "Saken er avsluttet.";

  const farge =
    status === "fullfort" && utfall
      ? tekstFarge(UTFALL_STIL[utfall])
      : "text-dempet";

  return (
    <p className={`text-[13px] leading-relaxed ${farge}`}>
      {tekst}{" "}
      <Link
        href={`/krav/${sakId}`}
        className="font-medium underline decoration-current/30 underline-offset-2 transition hover:decoration-current"
      >
        Se saken →
      </Link>
    </p>
  );
}
