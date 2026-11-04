"use client";

// HoldKnapp — «hold inne for å bekrefte», basert på HoldButton fra React Bits
// (reactbits.dev — se lisensen der). Brukt der en handling ikke kan angres
// (slette konto, slette krav): et uhell-trykk kan ikke utløse den. Tilpasset
// Medhold:
// - TypeScript, norske standardtekster og skjermlesertekst.
// - Appens fargetokens som standard (dom-rød fylling), ingen glød (glow av).
// - Refs speiles i effekter i stedet for under render (prosjektets lintregler).
// - `onTap`-standard: et kort trykk viser «Hold inne for å bekrefte», så den
//   som trykker vanlig skjønner hva som skal til i stedet for at ingenting
//   skjer.
// - Lett haptikk når holdet starter og en suksess-puls når det er fullført.
// Selve mekanikken (konstant fyllefart, bølgekant, avbryt ved slipp/glipp,
// tastatur med Mellomrom/Enter, Esc avbryter) er uendret.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { haptikk } from "@/lib/haptikk";
import "./HoldKnapp.css";

const TAP_MS = 250;
const HIT_PAD = 10;
const LINEAR = (t: number) => t;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);
const HINT_MS = 1800;
// Tidskilde for holdet. Kalles KUN fra hendelser og requestAnimationFrame,
// aldri under render — React-kompilatorens renhetsregel klarer ikke å se det
// gjennom closurene, derfor ligger kallet her på modulnivå.
const naa = () => performance.now();

type Fase = "idle" | "holding" | "done";
type Inndata = "pointer" | "key" | null;

export function HoldKnapp({
  children = "Hold for å slette",
  doneLabel = "Slettet",
  icon = null,
  doneIcon = null,
  backgroundColor = "var(--dom-rod-bg)",
  fillColor = "var(--dom-rod)",
  textColor = "var(--dom-rod)",
  fillTextColor = "var(--bakgrunn)",
  size = "lg",
  radius = 16,
  fillDirection = "right",
  holdTime = 2000,
  releaseTime = 200,
  pressScale = 0.98,
  wave = true,
  waveAmplitude = 4,
  glow = false,
  resetAfter = 0,
  disabled = false,
  full = true,
  hint = "Hold inne for å bekrefte",
  onHold,
  onTap,
  className = "",
}: {
  children?: ReactNode;
  doneLabel?: ReactNode;
  icon?: ReactNode;
  doneIcon?: ReactNode;
  backgroundColor?: string;
  fillColor?: string;
  textColor?: string;
  fillTextColor?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  fillDirection?: "right" | "up";
  holdTime?: number;
  releaseTime?: number;
  pressScale?: number;
  wave?: boolean;
  waveAmplitude?: number;
  glow?: boolean;
  /** 0 = blir stående i «ferdig» (f.eks. mens en sletting pågår). */
  resetAfter?: number;
  disabled?: boolean;
  /** Full bredde (som Primærknapp). */
  full?: boolean;
  /** Vises kort ved et vanlig trykk. Tom streng = av. */
  hint?: string;
  onHold?: () => void;
  onTap?: () => void;
  className?: string;
}) {
  const [phase, setPhase] = useState<Fase>("idle");
  const [input, setInput] = useState<Inndata>(null);
  const [visHint, setVisHint] = useState(false);
  const phaseRef = useRef<Fase>("idle");
  const inputRef = useRef<Inndata>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const gesture = useRef<{ pointerId: number | null; start: number; rect: DOMRect | null }>({
    pointerId: null,
    start: 0,
    rect: null,
  });
  const timers = useRef<{ complete: number; reset: number; hint: number }>({
    complete: 0,
    reset: 0,
    hint: 0,
  });
  const hintId = useId();

  const go = (next: Fase, kind: Inndata = null) => {
    phaseRef.current = next;
    inputRef.current = kind;
    setPhase(next);
    setInput(kind);
  };

  const clearTimers = () => {
    window.clearTimeout(timers.current.complete);
    window.clearTimeout(timers.current.reset);
  };

  const anim = useRef({ raf: 0, p: 0, from: 0, to: 0, start: 0 });
  const drive = (to: number, duration: number, ease: (t: number) => number) => {
    const a = anim.current;
    cancelAnimationFrame(a.raf);
    a.from = a.p;
    a.to = to;
    a.start = naa();
    const step = (now: number) => {
      const t = duration > 0 ? Math.min(1, (now - a.start) / duration) : 1;
      a.p = a.from + (a.to - a.from) * ease(t);
      buttonRef.current?.style.setProperty("--hb-p", a.p.toFixed(4));
      if (t < 1) {
        a.raf = requestAnimationFrame(step);
        return;
      }
      a.raf = 0;
      if (a.to === 1) complete();
    };
    a.raf = requestAnimationFrame(step);
  };

  const complete = () => {
    if (phaseRef.current !== "holding") return;
    if (naa() - gesture.current.start < holdTime - 50) return;
    clearTimers();
    go("done", inputRef.current);
    haptikk("suksess");
    onHold?.();
    if (resetAfter > 0) {
      timers.current.reset = window.setTimeout(() => {
        go("idle");
        drive(0, releaseTime, EASE_OUT);
      }, resetAfter);
    }
  };

  const begin = (kind: Exclude<Inndata, null>) => {
    if (disabled || phaseRef.current !== "idle") return false;
    const button = buttonRef.current;
    if (!button) return false;
    gesture.current.start = naa();
    gesture.current.rect = button.getBoundingClientRect();
    setVisHint(false);
    haptikk("lett");
    go("holding", kind);
    drive(1, holdTime, LINEAR);
    timers.current.complete = window.setTimeout(complete, holdTime + 100);
    return true;
  };

  const tap = () => {
    if (onTap) {
      onTap();
      return;
    }
    if (!hint) return;
    setVisHint(true);
    window.clearTimeout(timers.current.hint);
    timers.current.hint = window.setTimeout(() => setVisHint(false), HINT_MS);
  };

  const release = ({ drifted = false }: { drifted?: boolean } = {}) => {
    if (phaseRef.current !== "holding") return;
    clearTimers();
    const held = naa() - gesture.current.start;
    go("idle");
    drive(0, releaseTime, EASE_OUT);
    if (!drifted && held < TAP_MS) tap();
  };
  const releaseRef = useRef(release);
  useLayoutEffect(() => {
    releaseRef.current = release;
  });

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !e.isPrimary || gesture.current.pointerId !== null) return;
    if (!begin("pointer")) return;
    gesture.current.pointerId = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignorer */
    }
  };

  const endPointer = (e: PointerEvent<HTMLButtonElement>, options?: { drifted?: boolean }) => {
    if (e.pointerId !== gesture.current.pointerId) return;
    gesture.current.pointerId = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignorer */
    }
    release(options);
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== gesture.current.pointerId) return;
    const r = gesture.current.rect;
    if (!r) return;
    const out =
      e.clientX < r.left - HIT_PAD ||
      e.clientX > r.right + HIT_PAD ||
      e.clientY < r.top - HIT_PAD ||
      e.clientY > r.bottom + HIT_PAD;
    if (out) endPointer(e, { drifted: true });
  };

  const handlePointerLeave = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "touch") endPointer(e, { drifted: true });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      if (inputRef.current === "key") release({ drifted: true });
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) begin("key");
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (inputRef.current === "key") release();
    }
  };

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;
    const measure = () => {
      button.style.setProperty("--hb-w", `${button.offsetWidth}px`);
      button.style.setProperty("--hb-h", `${button.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(button);
    return () => ro.disconnect();
  }, []);

  // Bytter man app/fane midt i holdet, avbrytes det (aldri en halv bekreftelse).
  useEffect(() => {
    if (phase !== "holding") return undefined;
    const cancel = () => releaseRef.current({ drifted: true });
    const onVisibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase]);

  useEffect(() => {
    const t = timers.current;
    const a = anim.current;
    return () => {
      window.clearTimeout(t.complete);
      window.clearTimeout(t.reset);
      window.clearTimeout(t.hint);
      cancelAnimationFrame(a.raf);
    };
  }, []);

  const direction = fillDirection === "up" ? "up" : "right";
  const sekunder = Math.round(holdTime / 100) / 10;
  const labels = (
    <>
      <span className="hold-button__idle" aria-hidden={phase === "done"}>
        {icon ? <span className="hold-button__icon">{icon}</span> : null}
        {children}
      </span>
      <span className="hold-button__done" aria-hidden={phase !== "done"}>
        {doneIcon ? <span className="hold-button__icon">{doneIcon}</span> : null}
        {doneLabel}
      </span>
    </>
  );

  const stil = {
    "--hb-radius": `${radius}px`,
    "--hb-bg": backgroundColor,
    "--hb-fill": fillColor,
    "--hb-text": textColor,
    "--hb-fill-text": fillTextColor,
    "--hb-hold": `${holdTime}ms`,
    "--hb-cycles": holdTime / 1100,
    "--hb-release": `${releaseTime}ms`,
    "--hb-press": pressScale,
    "--hb-wave": `${wave ? waveAmplitude : 0}px`,
  } as CSSProperties;

  return (
    // data-ingen-drag: et hold skal aldri samtidig dra et Bunnark.
    <div className={full ? "w-full" : "inline-block"} data-ingen-drag="">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`hold-button hold-button--${size}${full ? " hold-button--full" : ""}${
          className ? ` ${className}` : ""
        }`}
        data-phase={phase}
        data-input={input ?? undefined}
        data-direction={direction}
        data-glow={glow ? "true" : undefined}
        aria-describedby={hintId}
        style={stil}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endPointer(e)}
        onPointerCancel={(e) => endPointer(e, { drifted: true })}
        onLostPointerCapture={(e) => endPointer(e, { drifted: true })}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="hold-button__pulse" aria-hidden="true" />
        <span className="hold-button__label">{labels}</span>
        <span className="hold-button__clip" aria-hidden="true">
          <span className="hold-button__fill">
            <span className="hold-button__label hold-button__label--fill">{labels}</span>
          </span>
          <span className="hold-button__crest" aria-hidden="true">
            <span className="hold-button__label hold-button__label--fill">{labels}</span>
          </span>
        </span>
        <span id={hintId} className="hold-button__sr">
          Hold inne i {String(sekunder).replace(".", ",")} sekunder for å bekrefte
        </span>
      </button>
      {hint && (
        <p
          className="hold-button__hint mt-2 text-center text-[12.5px] text-dempet"
          data-vis={visHint ? "" : undefined}
          aria-live="polite"
        >
          {visHint ? hint : " "}
        </p>
      )}
    </div>
  );
}
