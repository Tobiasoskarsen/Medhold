import { Skjermramme, Skjelett } from "@/components/ui";

// Meg-skjelett: profilhode-sirkel + navn/e-post + to grupperte kort-blokker.
export default function Loading() {
  return (
    <Skjermramme animerInn={false} className="pt-6">
      <div className="flex flex-col items-center pb-5 pt-3">
        <Skjelett className="size-16 rounded-full" />
        <Skjelett className="mt-2.5 h-6 w-28" />
        <Skjelett className="mt-1.5 h-4 w-36" />
      </div>

      {[0, 1].map((g) => (
        <div
          key={g}
          className="mb-[18px] flex flex-col gap-0 divide-y divide-strek overflow-hidden rounded-2xl border-[0.5px] border-strek bg-flate"
        >
          {[0, 1].map((r) => (
            <div key={r} className="p-[14px]">
              <Skjelett className="h-4 w-32" />
            </div>
          ))}
        </div>
      ))}
    </Skjermramme>
  );
}
