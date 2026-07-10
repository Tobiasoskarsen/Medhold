import { Skjermramme, Skjelett } from "@/components/ui";

// Krav-detalj-skjelett: topp (tittel + beløp + stadium) + fire tidslinjerader.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-5">
      <Skjelett className="h-4 w-16" />
      <Skjelett className="mt-4 h-6 w-40" />
      <Skjelett className="mt-3.5 h-8 w-32" />
      <Skjelett className="mt-4 h-1 w-full" />
      <div className="mt-8 flex flex-col gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3.5">
            <Skjelett className="size-3.5 shrink-0 rounded-full" />
            <Skjelett className="h-12 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    </Skjermramme>
  );
}
