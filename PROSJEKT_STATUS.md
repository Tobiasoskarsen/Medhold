# PROSJEKT_STATUS.md

Løpende status for implementeringen av `MEDHOLD_ARBEIDSORDRE.md`. Oppdateres
etter hver fase.

## Faseoversikt

| Fase | Beskrivelse | Status |
|---|---|---|
| 0 | Rebrand + designfundament | ✅ Ferdig |
| 1 | Datamodell | ✅ Ferdig (migrasjoner ikke kjørt i Supabase ennå) |
| 2 | Skjermene | ✅ Ferdig (krever at migrasjonene kjøres for å funke live) |
| 3 | Saksbehandleren | ✅ Ferdig (migrasjoner 0013–0014 må kjøres) |
| 4 | Inntak og posisjonering | ✅ Ferdig |
| 5 | Ekte betaling | 🔒 Låst (krever egen beskjed) |
| Motion | Bevegelsesspråk (egen ordre) | ✅ Ferdig |
| Tillegg | Mørk modus + fyldigere Meg (på forespørsel) | ✅ Ferdig |
| Tillegg | Brevarkiv + kontakt support (på forespørsel) | ✅ Ferdig |

---

## Tillegg — mørk modus + Meg-side (på brukerens forespørsel)

- **Lys/mørk/system-tema:** `.mork`-token-overstyringer i `globals.css`
  (kun variabler → hele appen følger med). Ingen-FOUC-skript i `layout.tsx`
  setter `.mork` på `<html>` før paint (+ `suppressHydrationWarning`).
  Tema-velger `src/app/(app)/meg/Tema.tsx` (Lys/Mørk/System, lagres i
  localStorage, følger OS ved «system»). `color-scheme` satt for native
  kontroller. Medhold-merket bruker nå token-farger (følger tema).
- **Meg-side utvidet:** grupperte innstillinger (Konto, Utseende, Varsling,
  Om Medhold) i kort-seksjoner + Logg ut + Slett kontoen min. Erstatter den
  tynne flate lista.
- **Bonus:** `personvern`-siden ryddet fra gammel `slate`-palett til tokens
  (følger tema) og den døde `/konto`-lenka rettet til `/meg`.
- Verifisert i preview (380px): Meg i lys + mørk, tema-veksling uten FOUC/
  hydreringsfeil. Build/lint/test grønne.

## Tillegg — brevarkiv + kontakt support (på brukerens forespørsel)

- **Brevarkiv:** ny rute `/brev` som lister ALLE brev på tvers av krav (nyeste
  først: brevtype · avsender · dato · kravnavn), hver lenker til brev-detaljen.
  Nås via en segmentert veksler [Krav | Brev] (`KravBrevFaner`) øverst på både
  `/krav` og `/brev`. BunnNav-«Krav» er aktiv for begge (ingen 4. fane).
  Egen `loading.tsx`-skjelett.
- **Kontakt support:** rad «Kontakt support» på Meg (gruppe «Hjelp og info») —
  `mailto:` til `SUPPORT_EPOST` (ny konstant i `brand.ts`, satt til brukerens
  e-post inntil en dedikert adresse finnes).
- Verifisert: `/brev` = 200 med veksler + tom-tilstand. Build/lint/test grønne.

## Tillegg — telefonnummer (på brukerens forespørsel)

- **Telefon som valgfritt profilfelt** på Meg (Konto-gruppa), lagret i
  `user_metadata.telefon`, normalisert til E.164 (norsk 8-sifret → +47…).
  `lagreTelefon`-action + `Telefon.tsx` (speiler Fornavn-mønsteret).

## Tillegg — telefon-innlogging (bygget, flagg-gated)

- **Innloggingssiden** har nå en E-post/Telefon-veksler. Telefon-stien bruker
  Supabase `signInWithOtp({ phone })` + samme 6-boks kode-UI (`verifyOtp` type
  `sms`). Delt normalisering i `src/lib/telefon.ts`.
- **Gated bak `NEXT_PUBLIC_TELEFON_LOGIN`** (`telefonLoginPa()`). Vises kun når
  flagget = `"true"`. **Ingen falsk/bypass-kode** — ekte SMS krever en
  SMS-leverandør (Twilio e.l.) i Supabase. Uten provider feiler «Send kode»
  pent («Kunne ikke sende SMS-kode nå … bruk e-post»); e-post virker alltid.
- **For å skru på ekte SMS senere:** (1) sett opp SMS-provider i Supabase →
  Auth → Providers → Phone, (2) `NEXT_PUBLIC_TELEFON_LOGIN=true` i Vercel. Da
  virker telefon-login uten mer kodejobb. **Gjenstår (når SMS er live):** koble
  begge identiteter på én konto (updateUser({phone}) + verifisering i Meg) for
  «registrer med begge og velg innlogging».

## Motion — bevegelsesspråk (ferdig)

Implementert etter `MEDHOLD_MOTION_ARBEIDSORDRE.md`.

- **Fundament:** `motion`-pakken (v12). Tokens i `src/lib/bevegelse.ts`
  (VARIGHET/EASING/FJAER/INNTREDEN/STIGRING) + CSS-speiling i `globals.css`
  (`--bevegelse-*`, `.trykk`, `.inntoning`, `.skjelett`). `src/lib/haptikk.ts`
  (navigator.vibrate; byttes til Capacitor i fase 6). Felles
  `Bevegelsesramme` (MotionConfig `reducedMotion="user"` + LazyMotion) i
  (app)-layout og legg-til-brev.
- **Trykk-tilstander:** `.trykk` (skala 0.98 via CSS `:active`) på Primærknapp,
  Pillknapp, Kort (`klikkbar`), BunnNav og tidslinjelenker. Haptikk: primærknapp
  + BunnNav (`lett`); lagret brev, generert utkast, løst sak (`suksess`).
- **Skjerminntreden:** Skjermramme `animerInn` (stagger, maks 8 barn) på alle
  (app)-skjermer. Velkomst/innlogging bruker CSS-`.inntoning` (se valg 1).
- **Ruteoverganger:** `(app)/template.tsx` — dybde-glid fra høyre; fane-bytte
  (BunnNav-flagg i sessionStorage) → ren fade. Legg-til-brev glir opp fra bunn.
- **Levende detaljer:** `Belop` teller opp (imperativt `animate()`, textContent
  — ingen state per frame); StadiumIndikator fyller sist-fylte segment (scaleX);
  Tidslinje toner inn sekvensielt + linjesegmenter «tegnes» (scaleY).
- **Løst sak-seremoni:** grønn sluttnode (scale 0.6→1) + hake (pathLength 0→1) +
  haptikk. Utløses av «Marker som løst» i KravMeny; roligere variant første
  gang en løst sak åpnes i økten (sessionStorage per sak-id).
- **Skeletons:** `Skjelett` + `loading.tsx` for Hjem, /krav, /krav/[id].
- `prefers-reduced-motion` respekteres (MotionConfig + CSS-media). Build/lint/
  test grønne. Verifisert i preview: velkomst/innlogging + Hjem uten
  konsollfeil, innhold interaktivt fra første frame.

Valg tatt underveis:

1. **Velkomst/innlogging bruker CSS-`.inntoning`** (én rolig fade+løft) i stedet
   for Skjermramme-stagger, siden de er bespoke fullskjermskjermer uten
   Skjermramme. Enkleste tolkning som oppfyller «innhold toner inn ved mount».
2. **«Marker som løst»** fantes ikke som handling — la til et minimalt punkt i
   KravMeny (setter status='fullfort') så seremonien har en utløser. En «Sak
   løst»-hendelse legges øverst på tidslinjen.
3. **Bundle:** full `motion`-komponent ga en motion-tung chunk >35 kB gzip, så
   byttet til `LazyMotion` + `domAnimation` + `m`-komponenter (verifisert: ingen
   layout/drag/projection-kode bundlet). Måling er upresis fordi app-kode ligger
   i samme chunk; motion-andelen er lavere enn råtallet.
4. **`(app)/loading.tsx`** (Hjem-skjelett) dekker også /meg og /pluss kort ved
   navigasjon (Next scoper loading per segment). Akseptert — vises sjelden/kort.

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

## Fase 1 — Datamodell (ferdig)

Levert (seksjon 4 + seksjon 6):

- Migrasjoner `supabase/migrations/0007–0012`:
  - `0007_saker_gjeld.sql` — `saker` utvidet med kreditor, opprinnelig_kreditor,
    saksnummer, belop_hovedstol, belop_totalt, stadium (alle nullable).
  - `0008_brev.sql` — ny `brev`-tabell m/ RLS + datamigrering fra
    `document_note` (**samme id-er beholdes**, idempotent).
  - `0009_frister_kilde.sql` — `frister.kilde`
    (manuell/brev_eksplisitt/beregnet) + `frister.brev_id`.
  - `0010_brev_samtale_brev_id.sql` — `brev_samtale.brev_id` (additivt, fylt
    fra `document_note_id`).
  - `0011_profiler.sql` — `profiler`-tabell (plan gratis/pluss) m/ RLS.
  - `0012_slett_egen_konto_utvidet.sql` — dekker nå brev, brev_samtale,
    profiler m.fl. eksplisitt (guardrail).
- `src/lib/gjeld.ts` — STADIER, `nesteStadium`, `foreslaStadium`,
  `fylteSegmenter`, `leggTilDager`, `beregnFrist` (inkassovarsel/
  betalingsoppfordring → +14 dager, kilde='beregnet'). 9 enhetstester i
  `src/lib/gjeld.test.ts`, kjøres med `npm test` (Node innebygd test-runner).
- `src/lib/plan.ts` — `harPluss(brukerId)` (eneste gating-inngang), `erPilot()`,
  `PLUSS_PRIS`. Pilotmodus via `NEXT_PUBLIC_PILOT`.
- `src/lib/types.ts` oppdatert: Sak-gjeldfelter, `Brev`, `FristKilde` +
  Frist.kilde/brev_id, `Plan`/`Profil`.
- `npm run build`, `npm run lint`, `npm test` grønne.

Valg tatt underveis:

1. **Additiv migrering, ikke hard cutover.** `document_note` og
   `brev_samtale.document_note_id` beholdes side om side med `brev`/`brev_id`
   slik at den gamle sakssiden fortsatt virker fram til Fase 2. `brev` får
   samme id-er som `document_note`, så koblingen bevares. **Opprydding (drop
   document_note, gjør brev_id NOT NULL, drop document_note_id) gjøres i Fase 2**
   når de gamle skjermene fjernes.
2. **⚠ Migrasjonene 0007–0012 er skrevet, men IKKE kjørt i Supabase ennå.**
   De bør kjøres i SQL Editor (i rekkefølge) sammen med Fase 2, siden det er
   Fase 2-koden som først bruker de nye tabellene. Kjøres de nå, er det trygt
   (additivt), men ingen effekt før skjermene finnes.
3. **Enhetstester:** ingen test-runner fantes; bruker Node sin innebygde
   (`node --test`, Node 24 stripper TS-typer). `*.test.ts` er ekskludert fra
   `tsconfig` (unngår `.ts`-import-konflikt) og fra Next-bygget.
4. **`NEXT_PUBLIC_PILOT=true`** lagt i lokal `.env.local`. **Må settes i Vercel**
   (og din ekte `.env.local`) for at pilotmodus skal gjelde i prod. Uten den
   defaulter `harPluss` til gratis — uten effekt før gating tas i bruk (Fase 3).
5. **`slett_egen_konto`** trengte strengt tatt ikke endring (cascade dekker
   alt), men eksplisitte deletes er lagt til for å oppfylle guardrailen og tåle
   framtidige tabeller uten cascade.

---

## Fase 2 — Skjermene (ferdig)

Ny rutestruktur:
- `(app)/` route group (auth-vakt + `BunnNav` + ansvarsfraskrivelse): `/` (Hjem),
  `/krav` (liste), `/krav/[id]` (detalj m/ tidslinje), `/meg`.
- Offentlig: `/velkommen` (3.7), `/logg-inn` (e-post-OTP), `/personvern`.
- `/legg-til-brev` (fullskjerm flyt, utenfor (app) — ingen BunnNav).
- Slettet: `/saker/*`, `/login`, `/konto/*` + ubrukte komponenter (AiBrevhjelp,
  DokumentNotat, SakSkjema, Mal*, Merker, Topplinje, Bunntekst, LeggTilFrist/
  Steg-skjema, AutoSubmitAvkryssing) og `lib/maler.ts`.

Auth: middleware sender uinnlogget → `/velkommen`, innlogget bort fra
velkomst/innlogging → `/`. Onboarding-redirect fjernet (onboarding = første
brev). auth/confirm + signout retarget. Innlogging via `signInWithOtp`
(engangskode, `shouldCreateUser: true`); passord-UI fjernet (Supabase-støtten
urørt for eksisterende kontoer).

Verifisert mot mockups (380px): `/velkommen` og `/logg-inn` live (matcher).
Hjem-kortet og Krav-detalj-tidslinjen verifisert via en midlertidig
mock-forhåndsvisning (fjernet igjen), siden live authed-skjermer krever at
migrasjonene er kjørt + innlogging. `npm run build/lint/test` grønne.

Valg / avvik tatt underveis:

1. **Hjem-primærknapp = «Se saken»** (ikke «Lag utkast til svar»). Utkast er
   Fase 3 og gated via `harPluss()`. Da byttes verbet og «Se hele saken»-lenka
   kommer tilbake. Droppet den doble lenka nå.
2. **«Legg til brev» bruker dagens analyse** (forklaring/steg/eksplisitte
   frister). brevtype/avsender/beløp fylles manuelt i steg 3. Auto-uttrekk +
   krav-matching (5.1) + **beregnede** frister kobles i **Fase 3**. Eksplisitte
   frister lagres med `kilde='brev_eksplisitt'`.
3. **«Ta bilde» / «Last opp»** vises ikke (Fase 4) — kun tekst-innliming.
4. **Tidslinjen er presentasjonell** (brev-hendelser + frist-piller + løse
   frister). «Trykk for å åpne brevets forklaring/samtale» er **Fase 3**
   (sakskontekst i samtalen). `api/brev-samtale` og `document_note` er urørt
   inntil da.
5. **Krav-redigering/-sletting** bak `MoreVertical`: sletting implementert.
   Egen «rediger krav»-skjerm finnes ikke i mockupene → utelatt.
6. **«Logg ut» lagt til på Meg** — avvik fra «ingen andre elementer» i 3.6, men
   nødvendig funksjon. Diskret, dempet. Flagges her.
7. **`.next` måtte slettes** etter ruteomlegging (stale route-typer pekte på
   `/saker`) — kjent gotcha.

⚠ **Authed-skjermene feiler mot live-DB til migrasjonene 0007–0012 er kjørt**
(de spør etter kreditor/stadium/brev som ikke finnes ennå). Kjør dem i Supabase
SQL Editor før du logger inn og tester.

---

## Fase 3 — Saksbehandleren (ferdig)

**5.1 Utvidet analyse + matching:** `SVAR_SKJEMA` utvidet med brevtype (enum),
avsender, brevdato, belop, saksnummer — «kun eksplisitt»-regelen beholdt.
Etter analyse i kode: `beregnFrist(brevtype, brevdato)` (inkassoloven §§ 9–10)
kjøres, og brevet matches mot eksisterende krav (saksnummer → kreditor/avsender,
case-insensitivt). «Legg til brev»-steg 3 forhåndsfyller feltene, forhåndsvelger
matchet krav, og viser beregnet frist som egen av/på-rad («beregnet — sjekk
brevet»). Frister lagres med riktig `kilde`; kravet oppdateres med stadium/beløp/
saksnummer ved lagring.

**5.3 Utkast + paywall + gating:** migrasjon `0013_utkast.sql` (utkast-tabell +
RLS, `slett_egen_konto` utvidet). `lagUtkast(sakId, brevId, type, detaljer)`
gated via `harPluss()`. Utkast-skjerm `/krav/[id]/utkast` (type-valg + kort
skjema → generert, redigerbar tekst + «Kopier» + fast «send det selv til …»).
Utkast lagres som tidslinjehendelse. Paywall `/pluss` (tre punkter + pris fra
`PLUSS_PRIS`; i pilotmodus «Alt er gratis i pilotperioden»). Hjem-kortet viser
nå «Lag utkast til svar» + «Se hele saken» når stadiet støtter utkast.

**5.2 Sakskontekst i samtalen:** `api/brev-samtale` repekt til `brev`/`brev_id`
med sakskontekst (kreditor, stadium, beløp, tidligere brev) hentet server-side
under RLS og lagt i systemprompten. Ny brev-detaljskjerm
`/krav/[id]/brev/[brevId]` (forklaring + original + strømmet samtale);
tidslinjens brev-hendelser lenker hit. `0014_drop_document_note.sql` fullfører
cutoveren (brev_id NOT NULL, dropper document_note + kolonnen), og fjerner
document_note fra `slett_egen_konto`.

`npm run build/lint/test` grønne.

Valg / avvik:

1. **Utkast lagres i egen `utkast`-tabell** (ikke gjenbruk av brev/steg) — reneste
   tidslinjehendelse. Vises som stille hendelse på kravet.
2. **Utkast-skjema = ett fritekstfelt** hvis ledetekst varierer med type
   (uenig i / betale per måned / hvorfor feil), per 5.3. Tomt felt nevnes ikke.
3. **Gating dobbelt:** både `lagUtkast` og `/krav/[id]/utkast`-siden sjekker
   `harPluss()`. Pilotmodus (NEXT_PUBLIC_PILOT) → alltid tillatt nå.
4. **Oversett-knappene** fra gamle DokumentNotat er ikke tatt med — ikke i
   Medhold-spec. Samtalen støtter fortsatt «oversett til …» som vanlig spørsmål
   (dir="auto" for RTL).
5. **`document_note` droppes i 0014** — kjør den ETTER at Fase 3-koden er i drift
   (koden bruker kun `brev` nå).

⚠ **Migrasjonene 0007–0014 må kjøres i Supabase (i rekkefølge)** før authed-
skjermene virker mot live-DB. 0013–0014 er nye i denne fasen.

---

## Fase 4 — Inntak og posisjonering (ferdig)

- **Bildeinntak (5.4):** `analyserBrevBilder(bilder)` sender foto/PDF som base64
  til Claude vision med samme skjema + `ekstrahert_tekst` (transkripsjon). Maks
  2 filer. **Kun teksten lagres** (original_tekst = transkripsjonen), aldri
  bildet. Deler etterbehandling (beregnet frist + krav-matching) med tekst-
  analysen via `etterbehandle()`.
- **«Ta bilde» / «Last opp fil» / «Lim inn tekst»** er nå tre valg i steg 1 av
  flyten (kamera-input `capture=environment`, fil-input `image/*,application/pdf`).
- **Gjeld-først velkomst:** «Fått inkassovarsel? Få oversikt, frister og et
  ferdig utkast til svar — samlet på ett sted.»
- **PWA-manifest:** `app/manifest.ts` (navn, ikoner 192/512 + maskable, farger,
  standalone, nb). Lagt til i proxy-matcher-unntaket så den er offentlig.

`npm run build/lint/test` grønne. Verifisert velkomst + manifest live.

Valg:
1. Bildeinntak støtter `image/*` og `application/pdf` (document-blokk for PDF).
2. Landingssiden er velkomst-skjermen med gjeld-først-tekst (ikke en egen
   marketing-side) — holder 3.7 minimal, men med riktig vinkling.

---

## Lukke løkka — Fase A: Sendingen (ferdig)

Fra «her er et utkast» → «sendt, venter på svar». Appen sender ALDRI selv —
sending skjer via brukerens egen e-postklient (`mailto:`).

- **Migrasjon `0015_sending.sql`** (additiv): `brev.avsender_epost`,
  `utkast.sendt_at`. `slett_egen_konto()` uendret (kolonnene ligger i tabeller
  som allerede slettes eksplisitt i 0014 — verifisert).
- **Uttrekk:** `SVAR_SKJEMA`/`VISJON_SKJEMA` utvidet med `avsender_epost` (KUN
  hvis eksplisitt). Redigerbart felt i steg 3, lagres på `brev`.
- **Utkast-skjerm:** «Åpne i e-post» bygger `mailto:` (mottaker = avsenders
  e-post, emne = «{type} – saksnummer {nr}» / «… – {kreditor}», body =
  redigert tekst). «Kopier» beholdt + hjelpetekst om body-lengde.
  `Primærknapp` støtter nå `mailto:` (vanlig `<a>`, ikke next/link).
- **«Jeg har sendt det»** → `markerUtkastSendt`: `utkast.sendt_at=now()`, sak
  `aktiv → venter_pa_svar` (kun hvis aktiv), haptikk suksess. Finnes også som
  stille rad under usendte utkast på tidslinjen (`MarkerSendtKnapp`).
- **UI:** sendte utkast = tidslinjehendelse «{type} sendt» på sendt-dato;
  status-etikett «Venter på svar» på krav-detalj + i kravlisten; Hjem-kortet
  for `venter_pa_svar`-saker: «Venter på svar fra {kreditor}» + «Fått svar?
  Legg til brevet».

Valg tatt underveis:
1. `markerUtkastSendt` bruker `.eq("status","aktiv")` i update-en så
   ventende/løste saker ikke røres (enkleste «kun hvis aktiv»).
2. Hjem-«venter»-varianten vises kun når saken ikke også har en presserende
   åpen frist (frist vinner — konkret handling foran venting).

⚠ **Migrasjon 0015 må kjøres i Supabase** før flyten virker live (avsender_epost
+ sendt_at). `build`/`lint`/`test` grønne. Live-preview av hele send-flyten
avventer at migrasjonen kjøres (krever innlogging + generert utkast).

## Lukke løkka — Fase B: Ventetiden (ferdig)

- **Migrasjon `0016_oppfolging.sql`** (additiv): `sendte_oppfolginger`
  (`unique(sak_id)` = dedup, maks én oppfølging per sak) + RLS. `slett_egen_konto()`
  utvidet med eksplisitt delete.
- **`src/lib/oppfolging.ts`** — ren `oppfolgingsKandidater(saker, alleredeSendt,
  naa, dager=14)`. 5 enhetstester i `oppfolging.test.ts` (kjøres via `npm test`).
- **`sendOppfolging`** i `lib/epost.ts`: emne «Har du hørt fra {kreditor}?», to
  rolige stier (fått svar → legg inn brevet / ikke hørt noe → det er normalt).
  Fikset også to døde lenker i frist-e-posten (`/saker`→`/`, `/konto`→`/meg`).
- **Cron** (`api/cron/paaminnelser`): ny `kjorOppfolging()` etter fristvarslene,
  kalt i begge retur-stier. Finner venter_pa_svar-saker der siste aktivitet
  (nyeste av utkast.sendt_at / brev.opprettet) er ≥ 14 dager gammel og ikke
  fulgt opp før; respekterer samme `varsler_paa`-bryter; `dryRun` støttes;
  logger i `sendte_oppfolginger`.

Valg tatt underveis:
1. Én e-post per kandidat-sak (ikke samlet per bruker som fristvarslene), siden
   emnet refererer kreditoren. `unique(sak_id)` sikrer maks én per sak totalt.
2. Saker uten noen aktivitetsdato (verken sendt utkast eller brev) hoppes over
   (skal normalt ikke forekomme i venter_pa_svar).

⚠ **Migrasjon 0016 må kjøres i Supabase.** `build`/`lint`/`test` grønne (14
tester). Verifiser i prod med `?dryRun=1` + Bearer CRON_SECRET.

## Lukke løkka — Fase C: Utfallet (ferdig)

- **Migrasjon `0017_utfall.sql`** (additiv): `saker.utfall` (check: medhold/
  delvis_medhold/avvist/nedbetalingsavtale). slett_egen_konto uendret (kolonne
  på saker).
- **`types.ts`:** `SAK_UTFALL` + `UTFALL_ETIKETT` + `UTFALL_STIL` (medhold =
  emerald).
- **`SVAR_SKJEMA`:** nytt `svar_utfall` (medhold/delvis_medhold/avvist/
  nedbetalingstilbud/uklart), KUN når det fremgår eksplisitt.
- **`src/lib/utfall.ts`** (ren, testet): `utfallOvergang()` (kode beslutter
  status/stadium) + `svarUtfallTilSak()` (mapper AI-forslag → sak-utfall,
  `uklart`/`nedbetalingstilbud` håndtert). 4 enhetstester.
- **Steg 3:** «Hva betyr svaret?»-rad vises KUN når valgt eksisterende krav er
  `venter_pa_svar`; forhåndsvalgt fra AI (ikke ved `uklart`); «Vet ikke / la stå
  tomt» nullstiller. `lagreBrev` bruker `utfallOvergang` i eksisterende-krav-
  grenen. Medhold setter seremoni-flagget før navigasjon.
- **Krav-detalj:** utfall-pill under headeren; løst-hendelsen heter «Medhold —
  kravet er frafalt» ved `utfall='medhold'`, ellers «Sak løst».
- **KravMeny:** «Marker som løst» → utfallsvalg (4 + «Annet / vet ikke»);
  `markerLost(id, utfall?)` lagrer valgfritt utfall.

Valg tatt underveis:
1. Manuell «marker som løst» setter alltid `status='fullfort'` (brukeren lukker
   saken selv) og lagrer utfall som metadata — bruker IKKE `utfallOvergang`
   (som ville holdt delvis/avvist «aktiv»). Overgangslogikken gjelder svar-
   flyten der koden avgjør.
2. Utfall-pill vises for alle utfall (også delvis/avvist/nedbetaling som blir
   værende aktive), så fanget utfall er synlig.

⚠ **Migrasjonene 0015, 0016, 0017 MÅ kjøres i Supabase FØR deploy** — krav-
detaljen selecter nye kolonner (`utfall`, `sendt_at`, `avsender_epost`); uten
dem feiler spørringen og siden 404-er. `build`/`lint`/`test` grønne (18 tester).

---

## Gebyrsjekk (MEDHOLD_GEBYRSJEKK_ARBEIDSORDRE, ferdig i kode)

Deterministisk gebyrsjekk-motor: «AI tolker (trekker ut kostnadslinjer), kode
beslutter (vurderer mot maksimalsatser)».

- **`src/lib/gebyr.ts`** (ren, testet, ingen sideeffekter): versjonert
  `SATSVERSJONER` (2026) + `satserForDato()`, `sjekkKostnader()` (innenfor/
  mulig_over/over/ukjent med 1 kr slingring), `gebyrFunnTekst()` (kun
  «over»-funn). **16 enhetstester** i `gebyr.test.ts` (totalt 34 i suiten).
- **Satsene verifisert mot Finanstilsynet 2026-07-15** — identiske med ordrens
  §3 (750/38/38/113/1345 + begge salærtabellene). Ingen avvik.
- **Migrasjon `0018_gebyrsjekk.sql`** (additiv): `brev.kostnadslinjer jsonb` +
  `brev.gebyrsjekk jsonb`. `slett_egen_konto()` uendret (kolonner på `brev`,
  som allerede slettes eksplisitt i 0012 — verifisert). RLS urørt.
- **Brevanalysen:** `SVAR_SKJEMA`/`VISJON_SKJEMA` utvidet med `kostnadslinjer`
  (type/belop/tekst); systemprompt-regel «kun det som står eksplisitt, aldri
  summér, hovedstol er ikke en kostnadslinje». `etterbehandle()` kaller
  `sjekkKostnader` og legger resultatet ved analysen + lagring.
- **`Gebyrsjekk.tsx`** (ny komponent, gjenbruker `Kort`/`Pill`): vises i steg 3
  (under beløpsfeltene) og på brev-detaljen (fra lagret jsonb, rekalkuleres
  aldri). Ingen kostnadslinjer → panelet vises ikke.
- **`Pill` utvidet** med `suksess` (aksent-token) + `feil` (appens etablerte
  `red-*`-feilfarge). Krav-detalj: diskret rød pill «Mulig ulovlig gebyr» kun
  ved `over` på nyeste brev. Hjem: undertittel-linje når `over` + stadiet
  støtter utkast.
- **Utkast-kobling:** `lagUtkast` legger `gebyrFunnTekst` inn i prompten som
  «Fakta fra Medhold» + regel (kan vise til beløpet over maksimalsats, uten
  paragrafnummer, uten å skjerpe tonen). Kun `over` sendes. Info-rad på
  typevalget når `over`.

Valg tatt underveis:
1. **Hovedstol = totalt beløp.** Appen har ikke et eget hovedstol-felt; §5s
   `belop_hovedstol` mates med det totale beløpet AI-en fant. Konservativt: et
   høyere beløp gir aldri et lavere salærtrinn → mindre sjanse for falsk «over».
2. **Rød farge = `red-*` (rå Tailwind), ikke et nytt token.** Dette er appens
   allerede etablerte feilfarge (samme som `HASTEGRAD_STIL.overtid` og alle
   feilmeldinger). Grønn = eksisterende `aksent`-token, gul = `varsel`-token.
   Ingen nye farger utenfor det etablerte mønsteret.
3. **Gebyrfunn i utkast for alle utkasttyper** (ikke bare innsigelse) når det
   finnes en `over`-linje — ordrens §8-brødtekst gater på funn, ikke type;
   prompten er permissiv («kan vise til»), så modellen bruker det passende.
4. **Lagret gebyrsjekk beregnes ved analysetidspunktet** (AI-ens beløp/dato).
   Redigering av beløp i steg 3 rekalkulerer ikke — i tråd med §9.6 (lagret
   jsonb er sannheten for visning).

⚠ **Migrasjon `0018_gebyrsjekk.sql` MÅ kjøres i Supabase FØR deploy** — brev-
detaljen, krav-detaljen, Hjem og utkast-siden selecter `brev.gebyrsjekk`; uten
kolonnen feiler spørringene. `build`/`lint`/`test` grønne (34 tester).

---

## Google-innlogging + Meg-redesign (MEDHOLD_MEG_OG_GOOGLE_ARBEIDSORDRE, ferdig i kode)

**Del 1 — Google (Supabase OAuth, PKCE):**
- `src/app/auth/callback/route.ts`: bytter `code` → session, beriker `fornavn`
  fra Google (given_name/full_name/name, aldri overskriv), feiler pent til
  `/logg-inn?feil=google`. Kun relative `next`-mål (ingen åpen redirect).
- `src/app/logg-inn/GoogleKnapp.tsx`: `signInWithOAuth({provider:"google"})`,
  `redirectTo` = `location.origin/auth/callback?next=/` (aldri hardkodet).
  Nøytral hvit knapp, inline 4-farge Google-G, laste-tilstand.
- `logg-inn/page.tsx`: Google øverst → «eller»-delelinje → uendret e-postflyt.
  Ny feilkode `?feil=google`. **Verifisert i preview** (offentlig side).
- Ingen env-sjekker i koden; nøklene bor i Supabase. Kontosammenslåing skjer
  automatisk på lik verifisert e-post (ingen manuell koble-UI i v1).

**Del 2 — Meg-siden (profil, ikke skjema):**
- Nye byggeklosser i `meg/`: `Gruppe.tsx`, `Rad.tsx` (ikon+etikett+verdi+chevron;
  href/onClick/ren visning), `Utvidbar.tsx` (progressive disclosure, motion
  height/opacity, chevron roterer), `TemaRad.tsx`, `ProfilKort.tsx`.
- Struktur: profilhode (initial-sirkel) → «Rediger profil»-utvidelse (Fornavn+
  Telefon, delt state med Telefon-raden = to innganger) → Konto (Telefon,
  Innlogging fra `user.identities`) → Innstillinger (Tema-utvidbar, E-post-
  påminnelser-toggle i rad) → Hjelp (support, personvern) → Logg ut som rad →
  bunntekst (`{APP_NAME} {APP_VERSJON} · Ikke profesjonell rådgivning` + Slett
  konto). `APP_VERSJON="1.0"` i brand.ts.
- Gjenbruk uendret: `Fornavn`, `Telefon`, `TemaVelger`, `SlettKonto`, alle
  server actions, `/auth/signout`.

Valg tatt underveis:
1. **VarselInnstilling** gjort kompakt (kun bryteren; etikett/beskrivelse flyttet
   til raden). Funksjonelt uendret (samme `settVarsler`, optimistisk +
   rulle-tilbake) — kun innpakning, som 2.5 tillater.
2. **TemaVelger** fikk en valgfri `onEndring`-callback (og `NOKKEL`/`Tema`
   eksporteres) så Tema-raden kan vise nåværende valg live. Eksisterende
   oppførsel uendret.
3. Meg-«h1» beholdt som `sr-only` (mockupen har ingen sidetittel, men skjermleser
   trenger en overskrift).
4. Meg-siden er authed → kunne ikke browser-verifiseres herfra; bygget grønt,
   `/logg-inn` verifisert i preview.

⚠ **Del 0 (manuelt, Tobias) MÅ gjøres før Google virker:** Google Cloud OAuth-
klient (scopes openid/email/profile) + Supabase → Auth → Providers → Google
(Client ID/Secret) + URL Configuration: Site URL og Redirect URLs må inkludere
`https://<prod>/auth/callback` og `http://localhost:3000/auth/callback`. Uten
oppsettet feiler Google-knappen pent til `?feil=google`; e-post/SMS uendret.
`build`/`lint`/`test` grønne (42 tester).

---

## Deploy

Deployes til Vercel-prosjektet `app2` (prod). **Husk `NEXT_PUBLIC_PILOT=true`**
i Vercel-env, ellers gater `harPluss` utkast/bilde bak paywall.

## Neste økt

**Fase 5 — Ekte betaling (LÅST):** ikke start uten egen beskjed. Stripe
Checkout + kundeportal koblet inn i `harPluss()`-punktet, pilotflagg av.
