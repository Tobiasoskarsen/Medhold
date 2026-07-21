// Bevegelses-tokens for Medhold. Én fil eier alle verdier — ingen tall eller
// easing hardkodes i komponenter (MEDHOLD_MOTION_ARBEIDSORDRE seksjon 2.2).

// Varigheter (sekunder, for motion). CSS-varianter finnes som CSS-variabler i
// globals.css (--bevegelse-*), holdt i synk med disse.
export const VARIGHET = {
  hurtig: 0.15, // trykk-tilstander, opasitet
  normal: 0.2, // inntreden av elementer, ruteovergang
  rolig: 0.25, // bunnark, større flater
  seremoni: 0.6, // KUN løst sak-haken
  stempel: 0.35, // Dommens inntreden — kjøres én gang ved mount (Motion2 §4)
} as const;

// Glid-avstand (px) for ruteoverganger der delte elementer (layoutId) finnes
// — redusert fra standard 12px slik at layout-animasjonen dominerer i stedet
// for å konkurrere med sideglidet (Motion2 §1).
export const GLID_DYBDE = 8;

// Opasitet på lenkeinnhold mens navigasjonen er pending (Motion2 §2) — umiddel-
// bar respons ved trykk, beholdes til ny rute er montert.
export const PENDING_OPASITET = 0.6;

// sessionStorage-flagg satt av kravkortet rett før trykk (Motion2 §1), lest og
// fjernet av krav-detaljens beløp ved mount: forteller at beløpet allerede er
// kjent (kom via delt layoutId-overgang) — ingen ny telling. Direktevisninger/
// refresh mangler flagget og teller opp som før. Samme mønster som
// FANE_NAV_NOKKEL i BunnNav.tsx.
export const DELT_OVERGANG_NOKKEL = "medhold-delt-overgang";

// Easing for CSS-transitions (speiles av --bevegelse-easing i globals.css).
export const EASING_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";

// Samme kurve som EASING_CSS, men på array-form for motion-tweens.
export const EASING = [0.32, 0.72, 0, 1] as const;

// Spring for motion-komponenter (lav bounce, rask settling).
export const FJAER = { type: "spring", stiffness: 500, damping: 40 } as const;

// Standardvariant for inntreden.
export const INNTREDEN = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
} as const;

// Sekunder stagger mellom søsken. Maks 8 barn får forsinkelse; resten deler
// den siste delayen slik at lange lister aldri «drypper» lenge.
export const STIGRING = 0.05;
export const MAKS_STAGGER = 8;
