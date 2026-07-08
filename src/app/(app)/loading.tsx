import { Skjermramme, Skjelett } from "@/components/ui";

// Hjem-skjelett: hilsen + ett stort kort + tre kommende-rader.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-6">
      <Skjelett className="h-4 w-24" />
      <Skjelett className="mt-3 h-6 w-40" />
      <Skjelett className="mt-4 h-44 w-full rounded-2xl" />
      <div className="mt-8 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skjelett key={i} className="h-5 w-full" />
        ))}
      </div>
    </Skjermramme>
  );
}
