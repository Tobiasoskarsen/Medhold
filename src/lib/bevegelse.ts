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
  morf: 0.38, // Delt View-Transition kort→detalj (Motion2 §1) — bevisst lenger
  // enn normal, siden dette er ett øyeblikk per navigasjon, ikke gjentatt.
  trapp: 0.3, // Trappens søyler (Motion2 §3) — litt lenger enn normal, så
  // veksten faktisk er synlig, ikke bare et hakk.
} as const;

// Stagger mellom Trappens fire søyler — større enn den vanlige STIGRING
// (brukt til lister) slik at trinnene tydelig kommer ett etter ett.
export const TRAPP_STIGRING = 0.09;

// Glid-avstand (px) for ruteoverganger der delte elementer (view-transition-
// name) finnes — redusert fra standard 12px slik at morfingen dominerer i
// stedet for å konkurrere med sideglidet (Motion2 §1).
export const GLID_DYBDE = 8;

// Glid-avstand (px) for steg-bytte i onboarding-karusellen og logg inn sin
// kontakt↔kode-overgang (Onboarding/Logg inn-arbeidsordre §1.3/§2.2).
export const STEG_GLID = 28;

// Opasitet på lenkeinnhold mens navigasjonen er pending (Motion2 §2) — umiddel-
// bar respons ved trykk, beholdes til ny rute er montert.
export const PENDING_OPASITET = 0.6;

// sessionStorage-flagg satt av kravkortet rett før trykk (Motion2 §1), lest og
// fjernet av krav-detaljens beløp ved mount: forteller at beløpet allerede er
// kjent (kom via delt View-Transition-overgang, se ViewOvergang.tsx) — ingen
// ny telling. Direktevisninger/refresh mangler flagget og teller opp som før.
// Samme mønster som FANE_NAV_NOKKEL i BunnNav.tsx.
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

// Motion3: skjermorkestrering, BunnNav-indikator, onboarding-koreografi.

// Sekunder mellom skjermseksjoner i <Sekvens> (Motion3 §1–2) — kortere enn
// STIGRING-listestaggeret, siden dette er FÆRRE, STØRRE deler av en skjerm,
// ikke en lang liste av like elementer. MAKS_STAGGER gjelder også her.
export const ORKESTER_STIGRING = 0.07;

// Illustrasjonens glid-faktor relativt til STEG_GLID ved onboarding-
// steg-bytte (Motion3 §4.3) — illustrasjonen flytter litt mer enn
// tekstblokken for en subtil dybdefølelse (parallakse).
export const PARALLAKSE = 1.3;

// Fjær for BunnNav-indikatoren som glir mellom fanene (Motion3 §3) — litt
// stivere/raskere enn standard FJAER, siden det er en liten strek, ikke en
// flate.
export const INDIKATOR_FJAER = { type: "spring", stiffness: 600, damping: 42 } as const;

// Skala BunnNav-ikonet dupper til (→ 1 med FJAER) når fanen aktiveres
// (Motion3 §3) — kun ved bytte, aldri loop.
export const IKON_TRYKK_SKALA = 0.92;
