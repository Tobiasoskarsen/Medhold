"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";
import { INNTREDEN, STIGRING, VARIGHET, EASING, FJAER } from "@/lib/bevegelse";

/**
 * Tidslinje — vertikal kolonne med hendelser, nyeste øverst. Ved mount toner
 * hendelsene inn sekvensielt ovenfra, og linjesegmentene «tegnes» nedover i
 * takt. Kjøres kun ved mount (motion replayer ikke uten ny key).
 */
export function Tidslinje({ children }: { children: ReactNode }) {
  return (
    <m.div
      className="flex flex-col"
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: STIGRING } } }}
    >
      {children}
    </m.div>
  );
}

const hendelseVariant = {
  initial: { ...INNTREDEN.initial },
  animate: { ...INNTREDEN.animate, transition: FJAER },
};

const linjeVariant = {
  initial: { scaleY: 0 },
  animate: {
    scaleY: 1,
    transition: { duration: VARIGHET.normal, ease: EASING },
  },
};

/**
 * En hendelse på tidslinjen. `fremhevet` gir fylt node og hvitt kort; ellers
 * en stille rad med hul node.
 */
export type HendelseVariant = "normal" | "funn" | "venter";

/**
 * En hendelse på tidslinjen. `fremhevet` gir fylt node og hvitt kort; ellers
 * en stille rad med hul node. `variant`: «funn» gir dom-rød node, «venter»
 * stiplet grå node (kommende frister).
 */
export function TidslinjeHendelse({
  dato,
  fremhevet = false,
  sisteHendelse = false,
  variant = "normal",
  node,
  children,
}: {
  dato: string;
  fremhevet?: boolean;
  /** Skjuler den nedadgående linjen på den nederste hendelsen. */
  sisteHendelse?: boolean;
  variant?: HendelseVariant;
  /** Overstyr standardnoden (brukes til løst-sak-seremonien). */
  node?: ReactNode;
  children: ReactNode;
}) {
  return (
    <m.div className="flex gap-3.5" variants={hendelseVariant}>
      <div className="flex w-4 flex-col items-center">
        {node ? (
          node
        ) : variant === "funn" ? (
          <span className="mt-0.5 size-3.5 rounded-full border-2 border-dom-rod bg-bakgrunn" />
        ) : variant === "venter" ? (
          <span className="mt-0.5 size-3.5 rounded-full border-2 border-dashed border-dempet bg-bakgrunn" />
        ) : fremhevet ? (
          <span className="size-3.5 rounded-full border-[3px] border-bakgrunn bg-aksent shadow-[0_0_0_1.5px_var(--aksent)]" />
        ) : (
          <span className="size-2.5 rounded-full border-2 border-aksent bg-bakgrunn opacity-70" />
        )}
        {!sisteHendelse && (
          <m.span
            className="w-0.5 flex-1 bg-aksent opacity-35"
            style={{ transformOrigin: "top" }}
            variants={linjeVariant}
          />
        )}
      </div>
      <div className="flex-1 pb-4">
        <p className="eyebrow mb-1">{dato}</p>
        {children}
      </div>
    </m.div>
  );
}
