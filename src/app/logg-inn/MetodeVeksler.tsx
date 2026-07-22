"use client";

/**
 * Fysisk bryter mellom e-post/telefon — to knapper over en glidende
 * bakgrunnsflate. Kun rendret når telefonLoginPa() er sann (vises ikke i det
 * hele tatt ellers — ingen veksler for én eneste metode).
 */
export function MetodeVeksler({
  metode,
  onVelg,
}: {
  metode: "epost" | "telefon";
  onVelg: (m: "epost" | "telefon") => void;
}) {
  return (
    <div className="relative flex rounded-[11px] bg-strek p-[3px]">
      <div
        className="absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-lg bg-flate shadow-[0_1px_3px_rgba(28,43,51,0.12)]"
        style={{
          transform: metode === "telefon" ? "translateX(100%)" : "translateX(0)",
          transitionProperty: "transform",
          transitionDuration: "var(--bevegelse-normal)",
          transitionTimingFunction: "var(--bevegelse-easing)",
        }}
      />
      {(["epost", "telefon"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onVelg(m)}
          aria-pressed={metode === m}
          className="relative z-[1] flex-1 rounded-lg py-[9px] text-[13px] font-semibold"
          style={{
            color: metode === m ? "var(--blekk)" : "var(--dempet)",
            transitionProperty: "color",
            transitionDuration: "var(--bevegelse-normal)",
            transitionTimingFunction: "var(--bevegelse-easing)",
          }}
        >
          {m === "epost" ? "E-post" : "Telefon"}
        </button>
      ))}
    </div>
  );
}
