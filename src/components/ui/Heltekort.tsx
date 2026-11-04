import type { ReactNode } from "react";
import { NavLenke as Link } from "@/components/NavLenke";

/**
 * Heltekort — det ene tydelige kortet per skjerm (Retning B §4.4). Fjordgrønt
 * i lys modus, lagdelt nær-svart i mørk. `gull` brukes KUN ved medhold.
 * Aldri rødt (fargeregel) — funn vises som en `HeltChip variant="funn"` inni.
 *
 * `href` gjør øvre del (etikett + innhold) til én lenke; `knapp` rendres
 * UNDER og UTENFOR lenken (§5.2: knappen ligger utenfor lenken).
 */
export function Heltekort({
  etikett,
  variant = "standard",
  href,
  knapp,
  children,
  className = "",
}: {
  etikett: string;
  variant?: "standard" | "gull";
  href?: string;
  knapp?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const gull = variant === "gull";
  const topp = (
    <>
      <p
        className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${
          gull ? "text-gull" : "text-helt-etikett"
        }`}
      >
        {etikett}
      </p>
      {children}
    </>
  );
  return (
    <div
      className={`rounded-helt border px-5 pb-[18px] pt-5 ${
        gull
          ? "border-gull/30 bg-gull-bg text-blekk"
          : // Et svakt lys øverst til høyre gir flaten dybde uten å bli
            // en «effekt» (visuell ordre, fase 2).
            "border-helt-kant bg-helt-bg bg-[radial-gradient(130%_90%_at_100%_0%,rgb(255_255_255/0.08),transparent_55%)] text-helt-tekst"
      } ${className}`}
      style={gull ? undefined : { boxShadow: "var(--kort-skygge)" }}
    >
      {href ? (
        <Link href={href} className="trykk block">
          {topp}
        </Link>
      ) : (
        topp
      )}
      {knapp && <div className="mt-4">{knapp}</div>}
    </div>
  );
}

/** Liten etikett inni et heltekort: frist (nøytral) eller funn. */
export function HeltChip({
  variant,
  children,
}: {
  variant: "noytral" | "funn";
  children: ReactNode;
}) {
  return (
    <span
      className={`chip-inn rounded-full px-2.5 py-[5px] text-[12px] font-semibold ${
        variant === "funn"
          ? "bg-helt-funn-bg text-helt-funn-tekst"
          : "bg-helt-chip text-helt-tekst mork:border mork:border-helt-kant"
      }`}
    >
      {children}
    </span>
  );
}
