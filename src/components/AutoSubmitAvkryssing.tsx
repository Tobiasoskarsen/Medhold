"use client";

import { useOptimistic, useTransition } from "react";

type Props = {
  handling: (formData: FormData) => Promise<void>;
  id: string;
  sakId: string;
  fullfort: boolean;
  ariaLabel: string;
};

/**
 * Avkrysningsboks som sender en server action med en gang den endres.
 * Brukes for å huke av frister og neste steg som fullført. Viser den nye
 * tilstanden umiddelbart (optimistisk) og synker mot serveren etterpå.
 */
export default function AutoSubmitAvkryssing({
  handling,
  id,
  sakId,
  fullfort,
  ariaLabel,
}: Props) {
  const [optimistisk, settOptimistisk] = useOptimistic(fullfort);
  const [venter, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={optimistisk}
      disabled={venter}
      aria-label={ariaLabel}
      onChange={() => {
        const ny = !optimistisk;
        startTransition(async () => {
          settOptimistisk(ny);
          const fd = new FormData();
          fd.set("id", id);
          fd.set("sak_id", sakId);
          fd.set("fullfort", String(ny));
          await handling(fd);
        });
      }}
      className="size-5 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-50"
    />
  );
}
