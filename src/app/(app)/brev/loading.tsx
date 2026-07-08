import { Skjermramme, Skjelett } from "@/components/ui";

// Brevarkiv-skjelett: fane-veksler + tre brevkort.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-6">
      <Skjelett className="h-9 w-40 rounded-[10px]" />
      <div className="mt-4 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skjelett key={i} className="h-[68px] w-full rounded-2xl" />
        ))}
      </div>
    </Skjermramme>
  );
}
