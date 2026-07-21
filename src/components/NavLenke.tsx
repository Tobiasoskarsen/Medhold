"use client";

import Link from "next/link";
import type { ComponentProps, CSSProperties } from "react";
import { PENDING_OPASITET } from "@/lib/bevegelse";
import { useTrykkFeedback } from "@/lib/useTrykkFeedback";

const DEMP_STIL: CSSProperties = {
  transitionProperty: "opacity",
  transitionDuration: "var(--bevegelse-hurtig)",
  transitionTimingFunction: "var(--bevegelse-easing)",
};

/**
 * Drop-in-erstatning for next/link sin `Link`, brukt til ALL intern
 * navigasjon i appen: gir umiddelbar visuell respons (dempet opasitet) fra
 * trykk til ny rute er montert, i stedet for at trykket ser dødt ut mens
 * serveren henter neste skjerm (Motion2-arbeidsordre §2, garantert via
 * useTrykkFeedback — `useLinkStatus` blir ofte aldri pending når destinasjonen
 * er forhåndshentet). Stilen settes DIREKTE på `<Link>` (`<a>`), ALDRI på en
 * wrapping-boks rundt children — mange steder styrer flex/grid-klasser på
 * selve lenken og forventer at ikon/tekst er direkte barn (en tidligere
 * versjon som pakket children i en `<span>` brakk nettopp dette: SVG-er fikk
 * `display:block` fra Tailwind-reset og havnet over teksten, og stablede
 * `flex-col`-tekster mistet linjeskiftet). Samme props som Link — kun ett
 * sted eier logikken. Ikke bruk for eksterne lenker (mailto:, http://…).
 */
export function NavLenke({
  style,
  onPointerDown,
  ...rest
}: ComponentProps<typeof Link>) {
  const { aktiv, start } = useTrykkFeedback();
  return (
    <Link
      {...rest}
      onPointerDown={(e) => {
        start();
        onPointerDown?.(e);
      }}
      style={{
        ...DEMP_STIL,
        opacity: aktiv ? PENDING_OPASITET : 1,
        ...style,
      }}
    />
  );
}
