import { Camera, Clipboard, Upload } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";

const VALG = [
  { inntak: "kamera", etikett: "Skann", Ikon: Camera },
  { inntak: "fil", etikett: "Last opp", Ikon: Upload },
  { inntak: "tekst", etikett: "Lim inn", Ikon: Clipboard },
] as const;

/**
 * Hurtigrad på Hjem (R8): tre runde knapper rett inn i «Legg til brev» med
 * valgt inntaksmåte. Bare ekte mål, ingen døde knapper.
 */
export function Hurtigrad() {
  return (
    <ul aria-label="Legg til brev" className="mt-6 flex justify-center gap-5">
      {VALG.map(({ inntak, etikett, Ikon }) => (
        <li key={inntak}>
          <Link
            href={`/legg-til-brev?inntak=${inntak}`}
            className="trykk flex min-h-11 w-[72px] flex-col items-center gap-1.5 rounded-liten focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk focus-visible:ring-offset-2 focus-visible:ring-offset-bakgrunn"
          >
            <span className="flex size-[54px] items-center justify-center rounded-full bg-flate text-blekk">
              <Ikon className="size-[22px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-[13px] font-medium text-blekk">{etikett}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
