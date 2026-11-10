"use client";

import { useEffect } from "react";

/** Aktiv fane, ikke en lagringsmotor. Mobil-OS kan lukke uten beforeunload. */
export function useUlagretVern(aktiv: boolean, melding: string) {
  useEffect(() => {
    if (!aktiv) return;
    const vedLukking = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const vedLenke = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const lenke = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!lenke || lenke.hasAttribute("download") || lenke.target === "_blank") return;
      const maal = new URL(lenke.href, window.location.href);
      if (maal.protocol !== "http:" && maal.protocol !== "https:") return;
      if (maal.pathname === window.location.pathname && maal.search === window.location.search) return;
      if (!window.confirm(melding)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", vedLukking);
    document.addEventListener("click", vedLenke, true);
    return () => {
      window.removeEventListener("beforeunload", vedLukking);
      document.removeEventListener("click", vedLenke, true);
    };
  }, [aktiv, melding]);
}
