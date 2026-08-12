import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Skjermramme } from "@/components/ui";
import { NavLenke as Link } from "@/components/NavLenke";
import { DelKnapp } from "./DelKnapp";

/**
 * Delbart resultatkort (designretning 2-mockupene: «delbart kort» i
 * story-format). Kun tilgjengelig for saker som faktisk er medhold — samme
 * «seier»-definisjon Hjem sitt gullbanner bruker (status fullfort + utfall
 * medhold). Selve bildet genereres av `del/bilde/route.ts` (next/og,
 * samme mønster som opengraph-image.tsx) — verken kreditornavn eller andre
 * sak-detaljer tas med i bildet, kun beløpet, så det er trygt å dele.
 */
export default async function DelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { data: sak } = await supabase
    .from("saker")
    .select("id, status, utfall")
    .eq("id", id)
    .maybeSingle();
  if (!sak || sak.status !== "fullfort" || sak.utfall !== "medhold") {
    notFound();
  }

  const bildeUrl = `/krav/${id}/del/bilde`;

  return (
    <Skjermramme className="pt-5" animerInn={false}>
      <Link
        href={`/krav/${id}`}
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Tilbake
      </Link>

      <h1 className="font-serif text-[22px] font-medium tracking-[-0.01em] text-blekk">
        Del resultatet
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
        Ingen navn eller detaljer om saken din vises i bildet — kun beløpet.
      </p>

      <div className="mt-5 overflow-hidden rounded-[26px] border-[0.5px] border-strek">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bildeUrl}
          alt="Forhåndsvisning av det delbare resultatkortet"
          className="block w-full"
        />
      </div>

      <div className="mt-5">
        <DelKnapp sakId={id} />
      </div>
    </Skjermramme>
  );
}
