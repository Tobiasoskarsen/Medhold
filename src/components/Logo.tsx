export function Klarveimerke({ className }: { className?: string }) {
  // Sol som står opp over en svingete vei — «klar vei». Bruker currentColor.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path d="M7 10.5 A5 5 0 0 1 17 10.5 Z" fill="currentColor" />
      <path
        d="M3.5 15.5 C8 13, 15 13.6, 20.5 12"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M6 18.6 C10 16.9, 14 17.3, 18.5 15.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo({
  medUndertekst = false,
}: {
  medUndertekst?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Klarveimerke className="size-8 text-teal-600" />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-semibold tracking-tight text-slate-900">
          Klarvei
        </span>
        {medUndertekst && (
          <span className="mt-1 text-xs text-slate-500">
            Klar vei gjennom det vanskelige
          </span>
        )}
      </span>
    </span>
  );
}
