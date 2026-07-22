"use client";

/**
 * «Send på nytt om 0:30» → «Send på nytt» (klikkbar) ved 0. Ren presentasjon
 * — selve nedtellings-useEffect'en eies fortsatt av page.tsx (§2.4, ren
 * refaktor, ingen adferdsendring).
 */
export function NyttForsokLenke({
  sekunder,
  onSendPaNytt,
  deaktivert,
}: {
  sekunder: number;
  onSendPaNytt: () => void;
  deaktivert: boolean;
}) {
  return (
    <p className="mt-5 text-center text-[13px] text-dempet">
      {sekunder > 0 ? (
        <span>
          Send på nytt om 0:{String(sekunder).padStart(2, "0")}
        </span>
      ) : (
        <button
          type="button"
          onClick={onSendPaNytt}
          disabled={deaktivert}
          className="font-semibold text-aksent transition hover:opacity-80 disabled:opacity-50"
        >
          Send på nytt
        </button>
      )}
    </p>
  );
}
