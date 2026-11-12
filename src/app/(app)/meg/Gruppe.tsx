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
    <section className="mb-seksjon">
      {tittel && <h2 className="seksjonstittel mb-gruppe text-blekk">{tittel}</h2>}
      <div className="flex flex-col divide-y divide-strek overflow-hidden rounded-helt border border-kant bg-flate">
        {children}
      </div>
    </section>
  );
}
