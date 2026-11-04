import { Skjermramme, Skjelett } from "@/components/ui";

// Hjem-skjelett: hilsen, hovedkort og snarveier.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-6">
      <Skjelett className="h-4 w-24" />
      <Skjelett className="mt-3 h-6 w-40" />
      <Skjelett className="mt-5 h-[220px] w-full rounded-helt" />
      <Skjelett className="mt-seksjon h-5 w-36" />
      <div className="mt-gruppe grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skjelett key={i} className="h-[92px] w-full rounded-kort" />
        ))}
      </div>
    </Skjermramme>
  );
}
