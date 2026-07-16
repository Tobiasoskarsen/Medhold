import type { ReactNode } from "react";

/** Gruppekort med valgfri overskrift — rammen rundt en rekke `Rad`/`Utvidbar`. */
export function Gruppe({
  tittel,
  children,
}: {
  tittel?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-[18px]">
      {tittel && (
        <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-[0.4px] text-dempet">
          {tittel}
        </p>
      )}
      <div className="flex flex-col divide-y divide-strek overflow-hidden rounded-2xl border-[0.5px] border-strek bg-flate">
        {children}
      </div>
    </section>
  );
}
