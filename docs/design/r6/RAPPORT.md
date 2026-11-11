# Design R6 – sluttrapport, 11. november 2026

## A. Utgangspunkt og inventar

Base: `a9463562f2691b29e67c89e19dfec962279d09e6` (PR #68), etter R4 #66 og R5 #67. Egen gren `codex/design-r6`. Åpen PR #64 om backup er ikke berørt. Brukerens ucommittede gjennomgang er bevart.

| Område | Eksisterende grunnlag / funn | R6 |
|---|---|---|
| Global stil | `globals.css`: semantiske lys/mørk-tokens, Schibsted, radius 10/14/20/26 px og seksjonsavstand 28 px | Videreført, ingen parallell stilpakke |
| Navigasjon | `BunnNav.tsx`: mørk flate, hvit indikator, ikondupp, safe area og tastaturviking | Lys flate, grønn tekst, mintindikator, ingen aktiveringsdupp |
| Hjem | `page.tsx` og `Heltekort`: eksisterende prioritering, stor mørk flate | Lyst hovedkort via eksisterende helt-tokens, grønn knapp, samme data/utvalg |
| Saker | Grupperte rader og eksisterende statuser | Samme rader, ny felles navigasjon |
| Oversikt | `Saksvisning.tsx` og saksiden: separate faner, løse native detaljtekster | Jevnere avstander, delestreker og chevron på detaljrader, integrert siste-brev-kort |
| Dokumenter | Samme ikon for brev/utkast/sendte | Dokument, redigeringsikon og hake med tekststatus; ensartet ikonbeholder |
| Historikk | `Tidslinje.tsx`, `SakensGangSeksjon.tsx`: kraftigere linje og uppercase dato | Nøytral linje, skannbare datoer, tydelig utvidelsesknapp og kommende oppfølging |
| Brevkontroll | `BrevGjennomgang.tsx`: egen sticky footer, tre steg og bekreftelse | Beholdt; bare felles knappfarge og kontrollomfangets detaljrad følger tokens |
| Utkast / betalingsforslag | Eksisterende `rounded-kort`, `bg-flate`, `Primærknapp` og kontrollspørsmål | Ingen ombygging eller endrede beregninger |
| Meg / innstillinger | Grupperte rader, eksisterende tema- og sletteflyt | Beholdt, felles navigasjon og knappfarge |
| Dialoger / feil / loading | `Bunnark.tsx` har portal, fokusvern og safe-area; semantiske varsel- og skjeletttokens | Ingen ny dialogmodell eller endrede feilstater |

## B. Designendringer og filer

- `src/app/globals.css`: lys navigasjonsflate `#fffefc`, kant `#e6e1d6`, lesbar dempet navigasjonstekst `#64675f`, aktiv `#103c38`. Ekte mørke overstyringer. Standardknapp fjordgrønn. Lyse helt-tokens og felles `.detaljrad`.
- `src/components/ui/BunnNav.tsx`: eksisterende fire mål, safe area, faneflagg og `aria-current` beholdt. Navngitt hovednavigasjon. Flat, rolig overflate; mintindikator og rund plussknapp. Eksisterende Motion-indikator og reduced-motion-ramme beholdt.
- `src/components/ui/Heltekort.tsx`: oppdatert stilbeskrivelse; visuell endring skjer med tokens.
- `src/app/(app)/krav/[id]/Saksvisning.tsx`: mindre avstand over/under fanene, ingen ny ruting eller remount.
- `src/app/(app)/krav/[id]/page.tsx`: bedre intern padding, konsekvente detaljrader, siste brev som rolig kort, lik ikonbeholder for dokumenter, hake kun ved eksisterende `sendt_at`. Kommende oppfølging har egen label fra eksisterende tilstand.
- `src/components/KontrollOmfang.tsx`: samme native detaljrad som saksoversikten; alle forbehold beholdt.
- `src/components/ui/Tidslinje.tsx`: roligere linje, tabellarisk dato og trygg krymping ved lange tekster.
- `src/app/(app)/krav/[id]/SakensGangSeksjon.tsx`: tettere start og tydelig fullbredde «Vis alle»/«Vis færre».

Varme bakgrunns-, mint- og typografitokens er bevart. Ingen installerte pakker. Bunnmenyen er mindre dominerende fordi den deler overflate med kortene, med kontrast i tekst og aktiv markering fremfor en stor mørk flate.

## C. Funksjonalitet og avgrensning

Ingen endringer i spørringer, actions, API-er, Supabase, RLS, AI, satser, versjoner, snapshots, idempotens eller sending. Dokumentlenker bruker samme sak-/brev-/utkast-ID-er. Ingen leveringsstatus påstås. Brevkontrollens tre steg, lagringsvalg og sikkerhetsbeskjeder er beholdt.

Nettleseren bekreftet fanebytte, utvidelse av begge detaljseksjoner, åpning av eksakt historisk brev, dokumentantall 2 og 9, utvidelse av 3 og 10 hendelser, Hjem/Saker/Meg og inngang til brevkontrollen. Dette er ikke en påstand om at hver eksisterende funksjon er nytestet ende til ende.

## D. Tester

- `npm test`: **404/404**.
- `npm run test:db`: **144/144** lokale DB-/modultester. Ingen tester endret eller svekket.
- Seks målrettede tester for faktisk saksidesammensetning og panelvalg kjørt igjen etter siste ikon-/labelendring: **6/6**.
- Endelig full lint: **0 feil, én eksisterende lokal advarsel**. Før ikonrettelsen viste den to nye ubrukte import-advarsler; årsaken er rettet og målrettet ESLint på siste saksiden bestått. Én gammel advarsel finnes i ignorert lokal `.env.release-guard`-kopi av GoogleKnapp.
- `npx tsc --noEmit`: bestått.
- `npm run build`: bestått, inkludert TypeScript. Ingen deploy.
- Faktisk IAB-nettleser, lokal Next-app med syntetiske saker i det verifiserte testprosjektet `evvzxblhaxaraaurbhsu`. Service role bare til disponibelt fixtureoppsett/opprydding; appinnlogging med testbruker.
- 320, 375, 390, 430, 768, 1024 og 1280 px: dokumentvisningen uten horisontal overflow; hovednavigasjonens lenker minst 44 × 44 CSS px. Se [målte verdier](viewports.json).
- Lys/mørk, lange avsendernavn, flere brev med samme tittel, utkast og registrert sendt, utvidet historikk samt opplysninger → kontroll → neste steg kontrollert. Ingen faktisk e-post/sending.
- Ved ferdig scroll lå siste handling over menyen: CTA-bunn 705,7 px, meny-topp 770 px i målingen.
- Midlertidig lokal Next-manifestfeil forsvant ved ny lasting. Ulagret brev hindret senere testnavigasjon som forventet; separat testfane brukt til sluttkontrollen.
- Begge disponible testkontoene og tilhørende data ryddet. Ingen produksjonsdata brukt.

## E. Visuelle bevis

Faktiske nettleserbilder. [Før](for/) og [etter](etter/) har samme første syntetiske konto, beløp, to dokumenter og lys modus for de sammenlignbare hovedvisningene.

| Før | Etter |
|---|---|
| [Hjem](for/hjem.png) | [Hjem lys](etter/hjem-lys.png), [mørk](etter/hjem-mork.png) |
| [Saker](for/saker.png) | [Saker lys](etter/saker-lys.png) |
| [Oversikt](for/oversikt.png) | [Oversikt lys](etter/oversikt-lys.png), [mørk](etter/oversikt-mork.png), [bunn etter scroll](etter/oversikt-bunn.png) |
| [Dokumenter](for/dokumenter.png) | [Dokumenter](etter/dokumenter.png), [endelig mobil med alle tre ikonstatuser](etter/dokumenter-endelig-mobil.png) |
| [Historikk](for/historikk.png) | [Historikk](etter/historikk.png), [ti hendelser](etter/historikk-mange.png), [endelig kommende-label](etter/historikk-endelig.png) |

[Åpne detaljer](etter/detaljer-apne.png), [Meg aktiv](etter/meg-lys.png), [lange avsendernavn](etter/dokumenter-lange-navn.png), [åpnet brev](etter/apnet-brev.png), [Opplysninger](etter/opplysninger.png), [Kontroll](etter/kontroll.png), [Neste steg](etter/neste-steg.png). Egen bildefil per skjermbredde i etter-mappen. Hjem-/Saker-/Meg-bildene viser respektive aktive navigasjon.

Kanttilfellene med ni dokumenter/ti hendelser er utvidet fixture og skal ikke leses som identisk før-/etter-data. Sluttkontrollens ikonbilder bruker en gjenskapt syntetisk konto med samme innhold. Tidligere dokumentbilder viser mellomversjonen; **endelig-mobil** viser siste ikoner. Fullsidebilder kan vise fixed-menyen midt i det lange bildet; det er ikke et bevis på sluttposisjon. Bruk eget bunnbilde og målingen for dette.

Avvik fra illustrasjonene: ingen bjelle, falsk fremdriftslinje, ny utkast-snarvei eller leveringskvittering. Den faktiske prioriteringen og oppfølgingsteksten bestemmes av appen. Referansenes oppdiktede data er ikke lagt i produktet.

## F. Begrensninger

Ingen ny fysisk iPhone-/Android-, VoiceOver-, stor-tekst-/200 %-zoom- eller OS-reduced-motion-prøve. Kodebasert reduced-motion-støtte og fokusregler er beholdt; ingen uavhengig full tilgjengelighetsrevisjon påstås. Ekte mobiltastatur/safe area må skilles fra desktopviewport.

Responsivitetsmålingene er systematiske på dokumentvisningen, ikke alle sider ved hver bredde. Ingen ny full PostgREST-sikkerhetsmatrise; ingen sikkerhetskode eller database endret. Analyse i visuell test bruker en lokal syntetisk adapter, ikke modellkvalitetsbevis. Kontosletting, betaling, kvotegrenser og e-postsendeflyt er ikke utført manuelt denne designrunden.

Ingen komplette mørke før-bilder eller samme-data stor-tekst-bilder; mørke etter-bilder er kvalitativ kontroll. Utviklerknapp og scrollbar er synlige i enkelte bilder. Endelige dokumentikoner ble kontrollert i lys modus; mørke kontrastflater bruker de felles semantiske tokenene.

## G. Endelig vurdering

1. Samme designsystem på Hjem/Saker/sak: ja i kontrollerte visninger.
2. Navigasjon matcher fargeprofil: ja, eksisterende fjordgrønn/mint og varm kortflate.
3. Mindre visuelt dominerende: ja, lys flate erstatter svart kapsel.
4. Primærhandlinger tydelige: ja, grønn knapp; sekundærvalg i rolige detaljrader.
5. Faste elementer dekker ikke viktig sluttinnhold: bekreftet i målt saksoversikt; fysisk tastatur/safe area ikke nytestet.
6. Dokumentstatus forståelig: ja, tekst og ulike ikoner; ingen «Levert».
7. Tidslinjen lettere å lese: ja, roligere linje/dato og tydelig kommende-label.
8. Lys/mørk konsistent: ja i prøvde skjermer, med begrensningene over.
9. Brevkontroll bevart: ja, samme tre steg og bekreftelseslås.
10. Klar for PR-gjennomgang: ja. Eventuell merge/deploy krever ny godkjenning.
