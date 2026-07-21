"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { PENDING_OPASITET } from "@/lib/bevegelse";

/**
 * Demper innholdet mens navigasjonen er pending. Må rendres som etterkommer
 * av `Link` (useLinkStatus-kravet) — se NavLenke under.
 */
function PendingInnhold({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      style={{
        opacity: pending ? PENDING_OPASITET : 1,
        transitionProperty: "opacity",
        transitionDuration: "var(--bevegelse-hurtig)",
        transitionTimingFunction: "var(--bevegelse-easing)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Drop-in-erstatning for next/link sin `Link`, brukt til ALL intern
 * navigasjon i appen: gir umiddelbar visuell respons (dempet opasitet) fra
 * trykk til ny rute er montert, i stedet for at trykket ser dødt ut mens
 * serveren henter neste skjerm (Motion2-arbeidsordre §2). Samme props som
 * Link — kun ett sted eier logikken. Ikke bruk for eksterne lenker (mailto:,
 * http://…) — de skal fortsatt rendres som vanlig `<a>`.
 */
export function NavLenke({ children, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link {...rest}>
      <PendingInnhold>{children}</PendingInnhold>
    </Link>
  );
}
