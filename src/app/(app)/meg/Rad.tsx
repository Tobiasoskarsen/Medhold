import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Rad — venstre ikon + etikett, høyre valgfri verdi/innhold + ChevronRight.
 * Varianter: `href` (lenke), `onClick` (knapp) eller ren visning. Chevron vises
 * som standard når raden er trykkbar; overstyr med `chevron`.
 */
export function Rad({
  ikon: Ikon,
  etikett,
  verdi,
  href,
  onClick,
  høyre,
  chevron,
}: {
  ikon: LucideIcon;
  etikett: string;
  verdi?: string;
  href?: string;
  onClick?: () => void;
  høyre?: ReactNode;
  chevron?: boolean;
}) {
  const visChevron = chevron ?? !!(href || onClick);
  const klasse = "flex items-center justify-between gap-3 px-[14px] py-3";

  const innhold = (
    <>
      <span className="flex items-center gap-2.5 text-sm text-blekk">
        <Ikon className="size-[17px] shrink-0 text-dempet" aria-hidden />
        {etikett}
      </span>
      <span className="flex items-center gap-1.5">
        {høyre ??
          (verdi && <span className="text-[13px] text-dempet">{verdi}</span>)}
        {visChevron && (
          <ChevronRight
            className="size-[15px] shrink-0 text-dempet"
            aria-hidden
          />
        )}
      </span>
    </>
  );

  if (href) {
    // mailto/eksterne mål skal ikke gjennom next/link-ruteren.
    const ekstern = href.startsWith("mailto:") || href.startsWith("http");
    return ekstern ? (
      <a href={href} className={`trykk ${klasse}`}>
        {innhold}
      </a>
    ) : (
      <Link href={href} className={`trykk ${klasse}`}>
        {innhold}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`trykk w-full text-left ${klasse}`}
      >
        {innhold}
      </button>
    );
  }
  return <div className={klasse}>{innhold}</div>;
}
