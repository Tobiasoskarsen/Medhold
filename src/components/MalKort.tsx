"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { KategoriIkon } from "@/components/Merker";
import type { Mal } from "@/lib/maler";

export default function MalKort({ mal }: { mal: Mal }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
    >
      <KategoriIkon kategori={mal.kategori} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-slate-900">{mal.tittel}</span>
          {pending ? (
            <Loader2
              className="size-4 shrink-0 animate-spin text-teal-600"
              aria-hidden
            />
          ) : (
            <ArrowRight
              className="size-4 shrink-0 text-slate-400"
              aria-hidden
            />
          )}
        </span>
        <span className="mt-1 block text-sm text-slate-500">
          {pending ? "Oppretter saken …" : mal.kort}
        </span>
        <span className="mt-2 block text-xs text-slate-400">
          {mal.steg.length} neste steg klare
        </span>
      </span>
    </button>
  );
}
