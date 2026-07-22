/**
 * Steg 2 — fire søyler, andre uthevet i aksent (dekorativ illustrasjon, ikke
 * den ekte Trapp-komponenten — onboarding har ingen sak å vise stadium for).
 * Tekst ordrett fra mockup.
 */
export function TrappSteg() {
  return (
    <>
      <div className="flex size-[180px] items-end justify-center">
        <div className="flex h-[120px] items-end gap-2">
          <span className="w-[26px] rounded-[6px] bg-strek" style={{ height: 34 }} />
          <span className="w-[26px] rounded-[6px] bg-aksent" style={{ height: 56 }} />
          <span className="w-[26px] rounded-[6px] bg-strek" style={{ height: 80 }} />
          <span className="w-[26px] rounded-[6px] bg-strek" style={{ height: 104 }} />
        </div>
      </div>
      <h1 className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk">
        Vi finner ut
        <br />
        <em className="italic text-aksent-dyp">hvor du står</em>
      </h1>
      <p className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet">
        Fristen din regnes ut automatisk, og vi viser nøyaktig hvor i
        prosessen saken befinner seg — ingen overraskelser.
      </p>
    </>
  );
}
