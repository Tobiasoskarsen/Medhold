import { TINT_KLASSE, tintFor } from "@/lib/tint";

/**
 * Den runde initial-sirkelen for en kreditor (R8). Tinten regnes ut fra navnet,
 * så samme kreditor alltid har samme farge. Rent dekor: navnet står ved siden av.
 */
export function KreditorAvatar({
  navn,
  className = "size-11 text-[17px]",
}: {
  navn: string;
  className?: string;
}) {
  const initial = navn.trim().charAt(0).toLocaleUpperCase("nb-NO") || "?";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${TINT_KLASSE[tintFor(navn)]} ${className}`}
    >
      {initial}
    </span>
  );
}
