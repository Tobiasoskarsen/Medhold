import { Skjermramme, Skjelett } from "@/components/ui";

// Brev-detalj-skjelett: tittel + avsender/dato + brevinnhold (forklaring) +
// gebyrsjekk-seksjon.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="h-4 w-16" />
      <Skjelett className="mt-4 h-6 w-40" />
      <Skjelett className="mt-1.5 h-4 w-32" />
      <Skjelett className="mt-4 h-[120px] w-full rounded-2xl" />
      <Skjelett className="mt-3 h-16 w-full rounded-2xl" />
    </Skjermramme>
  );
}
