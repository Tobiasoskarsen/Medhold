import type { ReactNode } from "react";

/**
 * Tidslinje — vertikal kolonne med hendelser, nyeste øverst.
 *
 * Presentasjonelt skall for Fase 0. Innhold (brev, frister, utkast,
 * stadium-endringer) kobles på i Fase 2 via `TidslinjeHendelse`.
 */
export function Tidslinje({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

/**
 * En hendelse på tidslinjen. `fremhevet` gir fylt node og hvitt kort;
 * ellers en stille rad med hul node.
 */
export function TidslinjeHendelse({
  dato,
  fremhevet = false,
  sisteHendelse = false,
  children,
}: {
  dato: string;
  fremhevet?: boolean;
  /** Skjuler den nedadgående linjen på den nederste hendelsen. */
  sisteHendelse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex w-4 flex-col items-center">
        {fremhevet ? (
          <span className="size-3.5 rounded-full border-[3px] border-bakgrunn bg-aksent shadow-[0_0_0_1.5px_var(--aksent)]" />
        ) : (
          <span className="size-2.5 rounded-full border-2 border-aksent bg-bakgrunn opacity-70" />
        )}
        {!sisteHendelse && <span className="w-0.5 flex-1 bg-aksent opacity-35" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="mb-0.5 text-xs text-dempet">{dato}</p>
        {children}
      </div>
    </div>
  );
}
