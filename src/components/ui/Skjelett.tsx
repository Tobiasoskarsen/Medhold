/**
 * Skjelett — avrundet flate i strek-fargen med rolig opasitetspuls (CSS,
 * står stille ved redusert bevegelse). Brukes i loading.tsx-skjermene.
 */
export function Skjelett({ className = "" }: { className?: string }) {
  return <div className={`skjelett ${className}`} aria-hidden />;
}
