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

## Designretning «juridisk tyngde med temperament» (MEDHOLD_DESIGN_ARBEIDSORDRE)

Evolusjon av tokens/komponenter — ingen ny navigasjon eller bevegelsesregler.

- **Fundament:** Newsreader via next/font (`--font-newsreader` → `font-serif`),
  serif kun til overskrifter/beløp/Dom/seier/profilhode (serif-regelen).
  Nye tokens (begge temaer): `dom-rod`/`dom-rod-bg`, `gull`/`gull-bg`,
  `aksent-dyp`. `.eyebrow`-klasse i globals.css.
- **Komponenter:** `Dom`/`DomMini` (signaturen ved over-funn, §-motiv), `Trapp`
  (StadiumIndikator restylet til 4 søyler + etiketter, `kompakt`-variant),
  `Nedtelling` (fristkort, rødt tall ≤10 dager). Gebyrsjekk-panelet viser nå
  full `Dom` øverst ved funn; øvrige linjer som piller under.
- **Skjermer:** Hjem (eyebrow-dato, deterministisk serif-H1, serif-beløp +
  kompakt Trapp i kortet, seier-kort ved medhold), krav-detalj (eyebrow, serif
  H1/beløp, rød beløpsnote, Trapp, Nedtelling, DomMini, «Skriv innsigelsen»-CTA,
  restylet tidslinje m/ funn-noder + venter-chip), brev-detalj/steg 3 (Dom),
  Meg (serif navn/initial/kolofon, eyebrow-gruppetitler), velkomst + logg inn
  (serif-H1). Serif-H1 påført øvrige sidetitler (utkast, nytt krav, personvern,
  pluss, intro, legg-til-brev).

Valg tatt underveis:
1. **`aksent-dyp` lagt til som token** (begge temaer) — mockupene bruker den til
   serif-kursiv og nåværende trapptrinn, men §1.2 listet den ikke. Lys #0a5c4c,
   mørk #4fc4a8 (WCAG AA verifisert).
2. **Trapp-mapping** (faktura/purring/inkassovarsel→trinn 1, oppfordring→2,
   forliksråd→3, namsmann/nedbetaling/avsluttet→4) ligger i `Trapp.tsx`
   (presentasjon); `fylteSegmenter` + testene er urørt (guardrail 7).
3. **Krav-detalj H1 = opprinnelig kreditor** (hovedkravet), eyebrow «… · sak hos
   {kreditor}» (inkassoselskapet) — følger mockupen; §3.2 skrev «H1: kreditor».
4. **DomMini-ord er typebevisst** (ett funn → typenavn, flere → «beløp») i stedet
   for hardkodet «salær», så teksten stemmer for purregebyr o.l.
5. **Beløp uten øre-splitt** (appen lagrer hele kroner) — serif + tabular-nums.
6. **Hjem:** logo/hilsen fjernet fra toppen (mockupen starter med eyebrow-dato).
   H1 pluraliserer frist-leddet («{N} frister.») ved flere enn én.
7. **Velkomst-fotlinjen** «Gratis å forstå brevet ditt · Norskutviklet» er en
   markedsføringspåstand → hører i advokatgjennomgangen (sann i pilot).

⚠ **Gjenstår (verifiseringsrunde):** eksplisitt mørk modus-gjennomgang skjerm for
skjerm, kontrastsjekk i praksis, full §3.7-konsistenspass (alle dialoger/
tomtilstander/skeletons) og evt. fjerning av den gamle slate-remap-blokken i
globals.css. `build`/`lint`/`test` grønne.

---

## Plan B — «Kravet stemmer»-sporet (MEDHOLD_PLAN_B_ARBEIDSORDRE, ferdig i kode)

En likeverdig dør for den som skylder riktig beløp. Gjenbruker hele løkka
(utkast → send → venter → oppfølging → utfall → seremoni).

- **`src/lib/avdrag.ts`** (ren, testet, 8 tester): `beregnAvdrag(total, manedsbelop)`
  → månedsbeløp/antall/siste avdrag, med clamp (1 kr … total).
- **Migrasjon `0019_plan_b.sql`** (additiv/idempotent): utvider `saker_utfall_check`
  fra 0017 med `oppgjort`. `slett_egen_konto()` uendret.
- **Utfall `oppgjort`** (types.ts): etikett «Oppgjort», nøytral token-stil.
  Settes KUN via «Jeg har betalt». `UTFALL_VALGBARE` (uten oppgjort) brukes i
  KravMeny + steg 3 «Hva betyr svaret?».
- **Utkasttyper splittet:** `betalingsutsettelse` = kun utsettelse;
  ny `nedbetalingsavtale` med egen prompt (bruk avdragstall ordrett, be om
  skriftlig bekreftelse + bero, verdig tone). Én-linjes forklaringer i typevalg.
- **`/krav/[id]/veier-ut`** + `VeierUtFlyt`: tre kort (Betal alt nå «Billigst» +
  «Jeg har betalt»-bekreftelse → utfall oppgjort; Nedbetalingsavtale +
  avdragshjelper-UI; Betalingsutsettelse) + NAV-lenke.
- **Dørvalget:** krav-detalj viser to likeverdige dører når det IKKE er
  gebyrfunn og stadiet ≥ betalingsoppfordring; ellers CTA + sekundærlenke.
  Steg 3 avsluttes med «Hva vil du gjøre?» (to dører + «Bestem senere»).
- **Seremoni-varianter** (samme komponent/animasjon): nedbetalingsavtale →
  grønn «Avtale på plass.», oppgjort → nøytral «Saken er ute av verden.»,
  medhold → uendret gull.

Valg tatt underveis:
1. **`nedbetalingsavtale` gir nå `status='fullfort'`** (+ stadium nedbetaling).
   Avvik fra Fase C (0017), der den var `aktiv` — §5 ber eksplisitt om fullført
   («saken har en slutt»). `utfall.ts` + testen oppdatert.
2. **Oppfølgings-e-posten var allerede typenøytral** («svaret ditt», «kravet
   ditt») — ingen endring nødvendig.
3. **NAV-lenke:** `https://www.nav.no/okonomi-gjeld` (eneste eksterne lenke i
   sporet — slug verifisert 2026-07-17; tidligere feil slug rettet).
4. Kvalitativ kostnadssetning på avtale-kortet (guardrail 4), ingen satser i v1.

⚠ **Migrasjonene `0019_plan_b.sql` OG `0020_utkast_nedbetalingsavtale.sql` MÅ
kjøres i Supabase** — 0019 utvider `saker.utfall` med `oppgjort`; 0020 utvider
`utkast.type`-constrainten med `nedbetalingsavtale` (glemt i Plan B — uten den
feiler nedbetalingsavtale-utkast med «Kunne ikke lagre utkastet»). Begge er
additive/idempotente; koden er uendret (ingen redeploy for 0020).
`build`/`lint`/`test` grønne (51 tester).

## Tekster til advokatgjennomgang

Samlet liste over påstander/tekster som bør sees av advokat før bred lansering:
- **Velkomst-fotlinjen:** «Gratis å forstå brevet ditt · Norskutviklet»
  (markedsføringspåstand; sann i pilot).
- **Veier ut → Betal alt nå:** «ingen betalingsanmerkning registreres for dette
  kravet» + «Billigst»-pillen (objektiv, men bør kvalitetssikres).
- **Veier ut → Nedbetalingsavtale:** «En avdragsordning kan gi noe ekstra
  omkostninger og renter frem til alt er betalt.»
- **Seremoni-tekstene:** «Avtale på plass. / Du har en plan — og saken har en
  slutt.» og «Saken er ute av verden. / Betalt og avsluttet.»
- **Gebyrsjekk/Dom-tekstene** (fra gebyrsjekk-ordren) — allerede juridiske i natur.
- **Referansebrevene i `src/lib/utkast-stemme.ts`** (fem stiler: innsigelse
  helt/delvis bestridt, nedbetalingsavtale vanlig/rettslig, betalingsutsettelse)
  — mekanismene de bygger på (omtvistet-erklæring, avslutt-eller-forliksråd,
  betal-det-du-er-enig-i, forliksklage-på-vent) bør juridisk kvalitetssikres
  før bred lansering, siden AI-en nå imiterer disse tekstene direkte i hvert
  utkast som genereres.
- **Veivalg-tekstene** (`src/components/Veivalg.tsx` og
  `krav/[id]/veier-ut/page.tsx`): sjekkliste-resultatene «Da er det god
  grunn til å svare på kravet …» og «Da ser kravet ut til å stemme …» er en
  ny form for anbefaling appen gir basert på brukerens egne svar — bør
  vurderes for at den ikke leses som juridisk rådgivning. Samme for
  kortundertekstene («Vi skriver brevet — du godkjenner før noe sendes» /
  «Bruk gebyrfunnet — vi skriver brevet») og veier-ut sin nye ingress («Tre
  helt vanlige måter å håndtere et krav på …»).

---

## Motion2 (MEDHOLD_MOTION2_ARBEIDSORDRE, ferdig i kode)

Kontinuitet: elementer blir til hverandre i stedet for å byttes ut, og hvert
trykk gir umiddelbar respons. Bygger på eksisterende `bevegelse.ts`.

- **`bevegelse.ts`-tillegg:** `VARIGHET.stempel` (Dommens inntreden),
  `GLID_DYBDE` (8px — redusert ruteglid der delte overganger finnes),
  `PENDING_OPASITET` (nav-feedback), `DELT_OVERGANG_NOKKEL` (sessionStorage-
  flagg, samme mønster som `FANE_NAV_NOKKEL`).
- **`src/lib/tell.ts`:** delt `tellOpp(el, til, formater)`-motor; `Belop` og
  `Nedtelling` (dagtallet ruller nå) bruker begge denne — ingen adferdsendring
  for Belop utover ny `tellOpp`-prop (default true).
- **Navigasjonsfeedback:** `src/components/NavLenke.tsx` — drop-in for
  `next/link`s `Link` via `useLinkStatus` (verifisert tilgjengelig i Next
  16.2.9), demper lenkeinnhold til ny rute er montert. Byttet inn i ALLE 16
  filer som brukte `next/link` (aliasert import, ingen JSX-endring i de
  fleste). Server actions hadde allerede spinnere (uendret).
- **`Trapp`:** søylene vokser inn (`scaleY` 0→1 fra bunn) med stagger, etiketter
  fader inn etter. **`Dom` (full):** stempler seg på (`scale`/`rotate`→0) én
  gang ved mount via statisk `initial`/`animate` (ingen ref-guard — ga
  `react-hooks/refs`-lint-feil; motion re-triggerer uansett ikke ved re-render
  med statiske props). `DomMini` uendret (ikke et stempel-øyeblikk).
- **§6 (skeleton→innhold):** vurdert og bevisst IKKE bygget som egen mekanikk —
  `Skjermramme` toner allerede inn barna sine (stagger), så innhold «popper»
  ikke hardt over skeletonen. En ekte kryssfade over Next sin Suspense-grense
  ble vurdert for skjørt/dyrt for gevinsten. Notert avvik.

**Delte overganger — VIKTIG rettelse underveis:** første forsøk brukte framer
sin `layoutId` (som §1 foreslo), men `layoutId` virker KUN innenfor ett montert
motion-tre — det krysser ikke Next App Router-rutegrenser (gammel side
avmonteres før ny monteres), så effekten var usynlig i praksis (deployet,
men gjorde ingenting). Bygget om til **native View Transitions**
(`document.startViewTransition`, browser-API, ingen ny avhengighet):
- `src/components/ViewOvergang.tsx`: provider i `(app)/layout.tsx` (remountes
  ikke ved navigasjon). `start(navigate)` kjører navigasjonen inni en
  transition og fullfører når ny rute faktisk er montert (lyttes via
  `usePathname`-effekt) — 600ms sikkerhetsnett hvis effekten ikke fyrer.
  Reduced motion → hopper rett til `navigate()`.
- `Kravkort.tsx`: egen klikk-handler (ikke `Link`) setter
  `style.viewTransitionName` KUN på det klikkede kortets navn/beløp rett før
  navigasjonen (så bare ETT kort morfer, ikke alle i listen), setter
  `DELT_OVERGANG_NOKKEL`, kaller `start(() => router.push(href))`.
- `KravHeader.tsx` (`KravNavn`/`KravBelop`): statiske `viewTransitionName` på
  H1/beløp (unikt per side — ingen kollisjon). `KravBelop` slår av
  `Belop`s telling når `DELT_OVERGANG_NOKKEL` er satt.
- `globals.css`: `::view-transition-group(*)` bruker `--bevegelse-normal`/
  `--bevegelse-easing` (samme mønster som `.trykk`); eksplisitt reduced-motion-
  forsvar i `@media`-blokken (universalselektoren `*` treffer IKKE
  `::view-transition-*`-pseudoelementer — egen regel nødvendig).
- Fjernet `DeltOvergangsRamme.tsx` (framer `domMax`-scoping) — ikke lenger
  nødvendig, `domAnimation` holder for resten av appen.
- Next sitt `viewTransition`-configflagg gjelder Reacts eksperimentelle
  `<ViewTransition>`-komponent, IKKE denne rå browser-API-en — ingen
  config-endring trengtes.

`build`/`lint`/`test` grønne (51 tester). Ingen migrasjon.

---

## Sakslisten (MEDHOLD_SAKSLISTE_ARBEIDSORDRE, ferdig i kode)

Saksliste som forteller hele historien på ett blikk; navigasjon matcher
brukerens hode («sakene mine», ikke «brevene mine»).

- **`src/lib/frist.ts`:** delt `erHastende`/`fristChipTekst` (samme ≤10-dagers-
  terskel og tekstformat «8 dager igjen»/«I dag»/«Frist utløpt» som
  `Nedtelling`, som nå selv bruker denne). Reeksporterer `dagerTil`.
- **`Kravkort` utvidet:** underlinje er nå kun stadium-etikett; nedtellingschip
  (dom-rod ≤10 dager/utløpt, ellers dempet) erstatter «neste frist …»-teksten;
  liten `§`-markør (dom-rod, `role="img"` + aria-label) ved siden av beløpet
  når nyeste brev har et lagret `over`-funn. Ny avsluttet-variant: `opacity-70`,
  ingen hover, beløp i dempet farge, utfallspill (`UTFALL_ETIKETT`/`UTFALL_STIL`)
  i stedet for venter/frist. View Transitions-logikken (§ guardrail 2) urørt.
- **`/krav`:** ny H1 «Sakene dine» + oversiktsstripe («N aktive · M venter på
  svar · K avsluttet», nulledd utelatt). Gruppert i Aktive (nærmeste frist
  først, ellers sist_endret) og Avsluttet (sist_endret, «Vis alle (K)» over 5
  via ny klientkomponent `AvsluttedeListe.tsx`, ingen paginering). Tomtilstand
  fikk kompakt `Trapp` (stadium `faktura` valgt som nøytral illustrasjon).
  Datahenting: `utfall` lagt til i `saker`-select; funn-markøren løst med ÉN
  ekstra spørring (`brev(sak_id, opprettet, gebyrsjekk)`, nyeste per sak_id
  holdt i minnet via at spørringen allerede er sortert — ingen N+1, ingen ny
  DB-kolonne).
- **Navigasjon:** `KravBrevFaner.tsx` slettet. BunnNav «Krav» → **«Saker»**,
  `ekstra: ["/brev"]` fjernet. `/brev` nås nå fra **Meg → Hjelp → «Alle brev»**
  (ikon `FileText`, over «Kontakt support»); fikk tilbakelenke til Meg + H1
  serif «Alle brev». Ingen redirect — direkte-lenker til `/brev` virker fortsatt.
- **`/brev`:** brev gruppert per sak (eyebrow-overskrift «{navn} · {N} brev»),
  gruppene ordnet på nyeste brev via ett lineært gjennomløp av den allerede
  sorterte listen (ingen egen sorteringsrunde). Samme `§`-markør som i
  kravlisten når brevets `gebyrsjekk` har et `over`-funn.

Valg tatt underveis:
1. Tomtilstandens `Trapp`-illustrasjon bruker stadium `"faktura"` (laveste
   trinn) — ordren spesifiserte ikke hvilket stadium, og «ingen aktive saker
   ennå» er nærmest et blankt utgangspunkt.
2. Funn-markøren i kravlisten vises KUN på aktive kort (avsluttede kort viser
   utfallspillen i stedet, som er mer informativ enn et gebyrfunn-hint på en
   allerede lukket sak) — konsistent med at `Kravkort` selv undertrykker
   markøren når `status==='fullfort'`.

`build`/`lint`/`test` grønne (51 tester — ingen nye, ren UI/gruppering).
Ingen migrasjon, ingen endring i datamodell/RLS.

---

## Onboarding + Logg inn (MEDHOLD_ONBOARDING_LOGGINN_ARBEIDSORDRE, ferdig i kode)

Én sammenhengende reise: velkomst → 4-stegs onboarding → logg inn. Tekst og
utseende fulgt ordrett fra de to godkjente mockupene, verifisert i browser
(DOM-inspeksjon — raw `style`/`aria-*`-attributter, ikke `getComputedStyle`
som viste seg upålitelig i dette preview-miljøet).

- **`/velkommen`:** tynn server-wrapper (`page.tsx`, redirect til `/` for
  innlogget bruker med `har_sett_onboarding=true`) + klientkomponent
  `Onboarding.tsx` med intern steg-tilstand (ingen egne URL-er). Fire
  presentasjonskomponenter i `velkommen/steg/` (Brev/Trapp/Dom/Veier) — egne,
  dekorative SVG/CSS-illustrasjoner, IKKE de ekte `Trapp`/`Dom`-UI-komponentene
  (som krever ekte sak-/gebyrsjekk-data onboarding ikke har).
- Steg-bytte: `opacity` + `translateX` (ny token `STEG_GLID=28` i
  bevegelse.ts) med `VARIGHET.normal`/`EASING`, alle fire steg alltid montert
  og CSS-stablet (unngår høyde-kollaps som ren `position:absolute` uten fast
  høyde ville gitt). Prikker, «Hopp over» (steg 1–3), ghost-tilbake (steg 2–4),
  «Kom i gang» → setter `localStorage` + `/logg-inn` — alt verifisert i
  browser.
- **`har_sett_onboarding`:** satt i `auth/callback/route.ts` (Google, sammen
  med fornavn-berikelsen) og i `logg-inn/page.tsx` sin `verifiser()`
  (e-postkode/SMS). Begge ikke-blokkerende (try/catch, feiler aldri
  innloggingen).
- **Logg inn:** `MetodeVeksler.tsx` (fysisk glidende bakgrunn,
  `translateX(0%/100%)`) og `NyttForsokLenke.tsx` (ren refaktor av
  nedtellingen). Kontakt↔kode-steg bruker samme CSS-stablingsteknikk som
  onboarding. Kodebokser: 44×56px, serif, stagger via eksisterende `STIGRING`
  (ikke `TRAPP_STIGRING`), kun ved steg-bytte (ikke tastetrykk, verifisert).
  Boksdimensjoner/radius oppdatert til mockup.

Valg tatt underveis:
1. **`/intro` (post-login, `sett_intro`-flagg) er en SEPARAT, eksisterende
   omvisning denne ordren ikke nevner og IKKE rører** (guardrail 3 forbyr
   redirect-endringer utover §1.5). En helt ny bruker vil derfor møte BÅDE
   den nye pre-login-onboardingen OG den gamle post-login-introen rett
   etter hverandre — mulig redundans, flagget for vurdering, ikke løst her.
2. **E-postkode/SMS har ingen egen server-callback-rute** —
   `auth/confirm/route.ts` viste seg ubrukt (ingen referanser i kodebasen;
   den ekte flyten verifiserer klientsidig i `logg-inn/page.tsx`). Satte
   derfor `har_sett_onboarding` der innloggingen faktisk fullføres
   (`verifiser()`s suksess-gren, bruker `data.user` fra selve
   `verifyOtp`-svaret — ingen ekstra rundtur), funksjonelt likeverdig med
   Google sin server-callback.
3. **Footnote-teksten «… engangskode på seks tegn» er IKKE hardkodet** —
   e-post-koden er faktisk 8 tegn i denne appen (admin.generateLink sin
   email_otp), kun SMS er 6. Hardkodet «seks» ville vært direkte feil for
   e-postbrukere. Erstattet med `{kodeLengde}` interpolert fra ekte state —
   samme mønster, korrekt tall.
4. **Gammel «‹ tilbake til /velkommen»-affordance fra logg-inn er borte** —
   ny tilbake-knapp vises KUN på kode-steget (som mockup, opacity 0 + ikke-
   interaktiv på inntast-steget) og går kun til «inntast», aldri til
   `/velkommen`. Nettleserens egen tilbakeknapp dekker fortsatt den veien.
5. **Gamle `/velkommen`-elementer uten motsvar i ny mockup er fjernet**: «Jeg
   har allerede en konto»-lenken og «Gratis å forstå brevet ditt ·
   Norskutviklet»-fotteksten. Alle brukere (nye og eksisterende) går via
   samme «Kom i gang» → `/logg-inn`, som uansett håndterer begge.
6. **`MetodeVekslers` glidende bakgrunn beholder `transform` under redusert
   bevegelse** (i motsetning til steg-bytte/kodebokser, som fjerner
   `transform` helt) — den globale CSS-regelen
   (`transition-duration:0.01ms!important`) gir et øyeblikkelig hopp til
   riktig posisjon uten synlig glid; å fjerne transformen helt ville i
   stedet SKJULT hvilken metode som er valgt. Bevisst, verifisert valg.

`build`/`lint`/`test` grønne (51 tester — ren UI/motion, ingen ny
forretningslogikk). Ingen migrasjon.

---

## Utkast-stemme (MEDHOLD_UTKAST_STEMME_ARBEIDSORDRE, ferdig i kode)

Retter den «robotaktige» tonen i AI-genererte utkast (viser til/anmodning/
substantivlister) med tre lag: referansebrev som few-shot, forbudsliste som
hard regel, og en deterministisk etterkontroll av output. Substansen i
utkastene (omtvistet-mekanismen, gebyrFunnTekst-tallene, avdragstallene) er
urørt — dette er en språkdrakt-operasjon.

- **`src/lib/utkast-stemme.ts`** (ren, ingen AI): `FORBUDTE_ORD` (15 ord/fraser,
  ordgrense- og Unicode-bevisst matching så «beroende»/«anmoderen»/«erlegges»
  ikke gir falske treff), `finnForbudteOrd()`, `TONEREGLER` (§3, 10 punkter),
  `REFERANSEBREV` (Record<UtkastType,string> — brev 1/3/4 ordrett, klage
  gjenbruker brev 1), `REFERANSEBREV_TILLEGG` (brev 2 delvis-bestrid + brev 5
  rettslig-nedbetaling — se avvik under) og `MOTEKSEMPEL` («slik skriver vi
  ikke»). **12 enhetstester** i `utkast-stemme.test.ts` (treff/ikke-treff,
  ordgrenser, kasus, frase vs. løsrevne ord).
- **`lagUtkast` bygget om:** systemprompten limer inn `TONEREGLER` +
  `MOTEKSEMPEL` + en stadium-avhengig regel for nedbetalingsavtale (se under).
  Referansebrevene sendes som ekte user/assistant-turer (few-shot) i
  meldingshistorikken — se avviksnotat 2. `saker.stadium` hentes nå i
  `lagUtkast` (ny spørring) for å avgjøre forliksråd/namsmann → rettslig
  nedbetalingsmønster.
- **Etterkontroll (§5):** etter generering kjøres `finnForbudteOrd` + en
  ordtelling. Treff eller over 300 ord → ÉN regenerering (utvider
  meldingshistorikken med det feilete utkastet + en rettemelding, ikke en
  løkke). Fortsatt treff etterpå → beholder likevel utkastet og logger
  (`console.error`) — blokkerer aldri brukeren.
- **Navnefelt (§6):** «Navnet ditt (slik det skal stå i brevet)» i
  utkast-skjermen (`UtkastFlyt.tsx`), forhåndsutfylt fra
  `user_metadata.brevnavn` ellers `fornavn`. Sendes til prompten som
  «Navnet mitt: …»; modellen instrueres å bruke akkurat denne verdien i
  signaturen, aldri finne på et. `lagUtkast` lagrer verdien til
  `user_metadata.brevnavn` (best-effort, blokkerer ikke generering ved feil)
  slik at neste utkast forhåndsutfylles med samme navn.
- **Verifisert mot ekte Claude-API** (frittstående skript, ikke i
  repoet — kjørt manuelt): alle fem utkasttyper, inkl. §8s to navngitte
  scenarioer (delvis bestrid med gebyrfunn: nevner 800/750/50 kr-differansen,
  hovedkrav betales, ingen forbudte ord; nedbetaling ved forliksvarsel:
  alle tre Brev 5-punktene til stede). Ingen av testkjøringene trengte
  etterkontroll-regenerering — few-shot + toneregler traff riktig første gang.
  `build`/`lint`/`test` grønne (62 tester).

Avvik/tvetydigheter tatt underveis:

1. **«Jeg viser til» byttet til «Jeg har mottatt» i brev 2–4.** §1s nye
   forbudsliste forbyr «viser til» («Jeg har mottatt …» brukes i stedet),
   men de ordrette referansebrevene i §2 (hentet fra
   MEDHOLD_REFERANSEBREV.md, uendret siden forrige ordre) åpner nettopp med
   «Jeg viser til …» i brev 2, 3 og 4. Brev 5 (nytt i denne ordren) bruker
   allerede «har mottatt». Rettet brev 2–4 til samme form for å ikke sende
   modellen et eksempel som bryter dens egen forbudsliste — selvmotsigende
   signaler ville svekket kondisjoneringen. Brev 1 var allerede riktig.
2. **`REFERANSEBREV` er `Record<UtkastType,string>` som spesifisert, men
   brukes som ekte few-shot-samtaleturer i `lagUtkast`, ikke som ren tekst
   limt inn i systemprompten.** Modulen eier teksten (streng-typen holdes),
   men prompt-byggeren (som §1 sier skal importere fra modulen) pakker den
   inn i syntetiske bruker/assistent-turer. Valgt fordi dette var arkitekturen
   som empirisk ga best stilkondisjonering i forrige runde (validert mot
   ekte API), og fordi det stemmer med ordrens egen §0-diagnose: «modeller
   imiterer eksempler langt bedre enn de følger adjektiver» — et ekte
   assistent-svar er en sterkere imitasjons-anker enn tekst modellen bare
   leser om.
3. **`REFERANSEBREV_TILLEGG`** (ikke i §1s eksplisitte eksportliste) holder
   brev 2 (delvis bestrid) og brev 5 (rettslig nedbetaling), siden
   `Record<UtkastType,string>` bare har plass til ÉN tekst per type, mens §2
   ber om to mønstre for både innsigelse og nedbetalingsavtale. Innsigelse
   sender alltid begge (modellen velger, som §2 sier); nedbetalingsavtale
   sender brev 3-mønsteret som few-shot uansett (grunntone) og legger brev
   5-malen + en eksplisitt hard regel (de tre punktene) i systemprompten KUN
   når `saker.stadium` er forliksråd/namsmann — kode bestemmer valget
   deterministisk, few-shotten alene fikk ikke holde ansvaret for et
   testbart akseptansekriterium.
4. **Emnelinjen («Emne: …») i referansebrevene genereres IKKE av AI-en.**
   Toneregel §3.9 nevner et emnelinje-format, og alle fem referansebrev har
   en Emne-linje øverst (beholdt ordrett i `utkast-stemme.ts`), men appen
   bygger allerede mailto-emnet deterministisk i `UtkastFlyt.tsx`
   (`byggEpost`). Å la AI-en ALSO skrive en emnelinje inn i brevteksten
   ville dupli­sert/kollidert med det når brukeren bruker «Åpne i e-post».
   Modellen instrueres eksplisitt til å hoppe over emnelinjen og starte på
   «Hei,».
5. **Navnet lagres automatisk ved hver vellykket generering** (ikke en egen
   lagre-knapp/on-blur som `Fornavn.tsx`), siden §6 kun ber om at det
   «huskes … etter første gang» — knyttet naturlig til den eksisterende
   generer-flyten, ingen ny UI-mekanikk nødvendig.

⚠ Ingen migrasjon i denne leveransen (kun `user_metadata.brevnavn`, samme
mønster som `telefon`/`fornavn` — ingen kolonneendring). `build`/`lint`/`test`
grønne.

## Veivalg (MEDHOLD_VEIVALG_ARBEIDSORDRE, ferdig i kode)

Erstatter det gamle standpunkt-baserte dørvalget («Jeg er uenig i kravet» /
«Kravet stemmer» — leses som tilståelse/konflikt) med et handlingsbasert
valg («Svar på kravet» / «Finn en måte å betale på») + en deterministisk
«hjelp meg å velge»-sjekkliste for den usikre brukeren. Ren tekst/UI —
destinasjonene (utkast-flyten, `/veier-ut`) er uendret. Ingen migrasjon.

- **`src/lib/veivalg.ts`** (ren, testet): `anbefalVei(svar)` →
  `"svar"`/`"betale"` etter regelen i §1 (tvil peker mot å svare). **11
  enhetstester** i `veivalg.test.ts` (åtte-kombinasjoners sannhetstabell +
  egne tester for at «vet ikke» på hvert av de to feltene som støtter det,
  gir «svar»).
- **`src/components/Veivalg.tsx`** (delt komponent): to handlingskort
  (ikonbrikke + tittel + undertekst + chevron) — «Svar på kravet» (§-ikon på
  `dom-rod-bg`) og «Finn en måte å betale på» (hake på `trygg/10`).
  Anbefalt-pillen (ny `aksent`-variant i `Pill.tsx`, samme fylte stil som
  knappene) og `border-aksent` på kort 1 vises KUN når `harGebyrfunn` er
  sann — deterministisk, appen synser aldri (guardrail 2). «Usikker? Hjelp
  meg å velge» ekspanderer sjekklisten (samme height/opacity-mønster og
  motion-tokens som `meg/Utvidbar.tsx`; reduced motion følger den delte
  `Bevegelsesramme`n, ingen egen gren). Resultatboksen har
  `aria-live="polite"`; toggelen har `aria-expanded`; alle spørsmålsknapper
  er ekte `<button>` med `aria-pressed`. Sjekklistesvarene lever kun i
  komponentens `useState` — ingen lagring, ingen sending til utkast-prompten
  (verifisert: ingen nye Supabase-kall lagt til for dette).
- **Mål-abstraksjon:** `VeivalgMål` er enten `{type:"href"}` (krav-detalj,
  navigerer direkte) eller `{type:"klikk", onKlikk, deaktivert?}` (steg 3,
  som må lagre brevet før navigering) — samme komponent dekker begge uten
  gren i selve `Veivalg.tsx`.
- **Krav-detalj (`krav/[id]/page.tsx`):** det gamle to-korts/CTA-splittet
  (`toLikeverdigeDorer`) er fjernet — `Veivalg` vises nå likt uansett
  gebyrfunn, kun pillen endrer seg. Synlighetsbetingelsen er uendret
  (`stotterUtkast(stadium) && !lost`).
- **Legg-til-brev steg 3:** samme komponent, `klikk`-mål kaller eksisterende
  `lagre("innsigelse"|"veier-ut")`. «Bestem senere — lagre i tidslinjen»
  sendes inn via `ekstra`-slotten, omstylt til en dempet tekstlenke (var en
  full kantet knapp) — se avvik 2.
- **`/veier-ut`:** H1 → «Veiene ut», ny ingress. Kortene og resten uendret
  (§3.3 — kun følgeendring).
- **Grep-verifisert:** «Kravet stemmer» finnes ikke lenger noe sted i `src/`
  (også ryddet to interne kodekommentarer som brukte frasen, i
  `avdrag.ts` og komponentens egen filkommentar — ikke brukergrensesnitt,
  men konsistent med akseptansekriteriet).
- **Verifisert i browser** (midlertidig uautentisert forhåndsvisningsrute,
  fjernet igjen — samme mønster som Fase 2s midlertidige mock-forhåndsvisning):
  begge korttilstander (med/uten Anbefalt-pill, `border-aksent` bekreftet
  via computed style), sjekklisten ekspanderer/kollapser, alle åtte
  svarkombinasjoner ga korrekt resultatboks og lenketekst («Start svaret →»
  / «Se veiene ut →»), gebyrdifferansen vises korrekt formatert i
  betale-resultatet, og deaktivert/klikk-modus (steg 3) fungerte. `build`/
  `lint`/`test` grønne (73 tester).

Avvik/tvetydigheter tatt underveis:

1. **Fasit-mockupen `medhold_kravskjerm_v2_mockup.html` finnes ikke i
   repoet** (kun eldre `design/medhold_krav_detalj_mockup.html`, ikke v2).
   Bygget direkte fra den detaljerte tekstspesifikasjonen i §2.1/§2.2 i
   stedet, og gjenbrukte etablerte tokens/mønstre der spesifikasjonen ikke
   ga et eksakt tall (ikonbrikke-størrelse, korthøyde, ANBEFALT-pillens
   fylte `bg-aksent`-stil hentet fra Primærknapp/Doms CTA-knapp). Bør
   sammenlignes mot ekte mockup når den finnes.
2. **«Bestem senere»-lenken i steg 3 er restylet** fra en full kantet knapp
   (`border-strek bg-flate`) til en dempet understreket tekstlenke, siden
   §3.2 eksplisitt sier «dempet tekstlenke» — et bevisst stilskifte fra
   Plan B-ordrens opprinnelige knappestil, ikke bare en ren flytting.
3. **Klage-typen har ingen spesialbehandling i Veivalg** (ordren nevner den
   ikke) — «Svar på kravet» peker til `?type=innsigelse` som før;
   utkast-skjermen lar brukeren bytte type der.

## Deploy

Deployes til Vercel-prosjektet `app2` (prod). **Husk `NEXT_PUBLIC_PILOT=true`**
i Vercel-env, ellers gater `harPluss` utkast/bilde bak paywall.

## Neste økt

**Fase 5 — Ekte betaling (LÅST):** ikke start uten egen beskjed. Stripe
Checkout + kundeportal koblet inn i `harPluss()`-punktet, pilotflagg av.
