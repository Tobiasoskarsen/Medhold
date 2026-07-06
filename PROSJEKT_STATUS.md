# PROSJEKT_STATUS.md

Løpende status for implementeringen av `MEDHOLD_ARBEIDSORDRE.md`. Oppdateres
etter hver fase.

## Faseoversikt

| Fase | Beskrivelse | Status |
|---|---|---|
| 0 | Rebrand + designfundament | ✅ Ferdig |
| 1 | Datamodell | ⬜ Ikke startet |
| 2 | Skjermene | ⬜ Ikke startet |
| 3 | Saksbehandleren | ⬜ Ikke startet |
| 4 | Inntak og posisjonering | ⬜ Ikke startet |
| 5 | Ekte betaling | 🔒 Låst (krever egen beskjed) |

---

## Fase 0 — Rebrand + designfundament (ferdig)

Levert:

- `src/lib/brand.ts` med `APP_NAME = 'Medhold'`. Alle «Klarvei»-forekomster i
  UI, metadata, e-postmaler, `types.ts` og `README.md` er erstattet (verifisert
  med søk — ingen igjen).
- Logo-filer fra spec 1.1: `public/logo-ikon.svg`, `public/logo.svg`,
  `public/logo-morkt.svg`. `src/app/icon.svg` og `src/components/Logo.tsx`
  oppdatert til Medhold-merket.
- PWA-ikoner `public/ikon-192.png` og `public/ikon-512.png` generert fra
  `logo-ikon.svg`.
- Inter via `next/font/google` erstatter Geist i `layout.tsx`.
- Designtokens (2.1) i `globals.css`, eksponert som Tailwind-farger
  (`bg-bakgrunn`, `text-blekk`, `border-strek`, `bg-aksent`, `bg-varsel-bg` …)
  via `@theme inline`. `prefers-reduced-motion` respekteres.
- Komponentbibliotek i `src/components/ui/` med barrel-eksport (`index.ts`):
  `Skjermramme`, `Kort`, `Primærknapp`, `Pillknapp`, `Pill`, `BunnNav`,
  `StadiumIndikator`, `Tidslinje` + `TidslinjeHendelse`.
- `npm run build` og `npm run lint` grønne. Boot verifisert i preview (375px):
  Inter aktiv, `bg-bakgrunn` = #F7F7F5, tittel «Medhold», ingen «Klarvei».

Valg tatt underveis (per arbeidsordrens instruks om å notere tvetydigheter):

1. **Designreferanser er HTML-mockups**, ikke PNG-filer. De ligger i
   `design/` i app2-roten (`medhold_hjem_skjerm_mockup.html`,
   `medhold_krav_detalj_mockup.html`, `medhold_velkomst_innlogging_mockup.html`).
   Brukt som visuell fasit.
2. **Favicon:** `sharp` er tilgjengelig, men skriver ikke `.ico`. Gammel
   `src/app/favicon.ico` (utdatert merke) er slettet; `src/app/icon.svg`
   (SVG) er nå faviconkilde (Next serverer den med `sizes="any"`).
3. **PWA-manifest** er ikke koblet inn ennå — ikonene finnes, men selve
   `manifest`-fila fullføres i Fase 4 (per faseplan pkt. 4).
4. **Gammel `slate`-remapping beholdt** i `globals.css` slik at eksisterende
   skjermer (dashbord, saksside, login) ikke regreder før de erstattes i
   Fase 2. Fjernes da.
5. **Komponentfilnavn er ASCII** (f.eks. `Primaerknapp.tsx`) med norske
   eksportnavn (`Primærknapp`), for å unngå encoding-fnugg på tvers av verktøy.
   Skjermer importerer fra `@/components/ui`.
6. **`BunnNav` bruker rutene** `/`, `/krav`, `/meg` (opprettes i Fase 2).
   Komponenten er ikke montert ennå.
7. **`Tidslinje`/`StadiumIndikator` er implementert som presentasjonelle
   komponenter** (ikke tomme), siden mockupene er tydelige. Datakobling skjer
   i Fase 2.
8. **Miljø:** `.env.local` er kopiert inn i worktreen (gitignorert) for å
   kunne kjøre `dev`/`build` lokalt.

Kjent, ufarlig: Next advarer om «multiple lockfiles» fordi worktreen har egen
`package-lock.json` i tillegg til app2-roten. Påvirker ikke bygget.

---

## Neste økt

**Fase 1 — Datamodell** (seksjon 4 + `profiler`/`plan.ts` fra seksjon 6):
`saker`-utvidelser, ny `brev`-tabell m/ RLS og datamigrering fra
`document_note`, `frister`-utvidelser, `slett_egen_konto()`-oppdatering,
`src/lib/gjeld.ts` med enhetstester, og `profiler`-tabell + `src/lib/plan.ts`.
