# Saksoversikt – 11. november 2026

Saken er delt i Oversikt, Dokumenter og Historikk. Ventende saker viser status og inngang til nytt svarbrev først. De eksisterende svar-/betalingsvalgene finnes under «Andre muligheter». Aktive saker viser valgene åpne. Dokumenter samler eksisterende brev og utkast med sine eksakte lenker; historikken beholder eksisterende hendelser og utvidelse.

Etter brevlesing brukes samme grupperte handlingsliste. Alle tre lagringsvalg, bekreftelser, ukjent-resultat-håndtering og alvorlighetsbetingelser beholdes. Ingen nye spørringer, API-er, avhengigheter eller juridiske beregninger.

## Verifisering

- `npm test`: 404/404.
- `npm run test:db`: 144/144 lokale DB-/modultester, inkludert seks nye tester for visningsvalg, ventende/aktiv/avsluttet sak, eksakte dokumentlenker og alvorsvarselets forrang. Første kjøring ble blokkert av lokal EPERM i en Node-avhengighet; full kjøring uten denne sandkassebegrensningen besto.
- `npm run lint`: 0 feil; én eksisterende advarsel i den ignorerte lokale `.env.release-guard`-kopien.
- `npm run build`: bestått, inkludert TypeScript.
- Faktisk lokal nettleser mot separat Supabase-testprosjekt, syntetisk konto: ventestatus, bytte til dokumenter/historikk, aktiv sak, lys/mørk modus og gjennomgang til de tre neste-steg-valgene. Bekreftelseslåsen før kontroll ble verifisert. 320 og 430 px uten horisontal overflow; mobilbilder ved 390 × 844-oppsett.
- Testkonto og tilhørende syntetiske data ryddet. Ingen produksjonsdata benyttet.

## Bilder

- [Ventende sak, lys](venter-lys.png)
- [Ventende sak, mørk](venter-mork.png)
- [Dokumenter, lys](dokumenter-lys.png)
- [Dokumenter, mørk](dokumenter-mork.png)
- [Aktiv sak](aktiv-lys.png)
- [Neste steg etter brevlesing](neste-steg-lys.png)

Bildene er faktiske lokale skjermbilder med syntetiske data. Nettleserens scrollbar og utviklerindikator kan være synlige. Brukerens før-bilder er ikke lagt i repoet, fordi de inneholder faktiske saksopplysninger.

Begrensninger: Ingen ny fysisk iPhone-/VoiceOver-/200 %-zoomtest, desktopgjennomgang eller ny full PostgREST-sikkerhetstest denne runden. Analyse i visuell test brukte lokal syntetisk modelladapter; dette beviser presentasjon og flyt, ikke AI-kvalitet. Visningsvalget tilbakestilles til Oversikt ved full sidenavigasjon. Ingen merge eller produksjonsdeploy.
