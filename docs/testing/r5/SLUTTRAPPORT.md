# R5 – sluttrapport

Arbeid utført 10.–11. november 2026. Ingen merge, produksjonsdeploy, migrasjon eller endring av produksjonsmiljø. Bare syntetiske data i testprosjektet.

## A. Faktisk utgangspunkt

- `main`: 901d0a930f463457b3f09a7f3cf1e66b27b6da31, PR #65.
- R4 PR #66: åpen, grønn GitHub CI og Vercel-preview ved oppstart; head d29d3f9. Ingen nyere main-commits.
- R5-gren: `codex/r5-mobil-gjenfinning`, stablet på R4. PR skal derfor ha R4-grenen som base til R4 er gjennomgått og merget separat. PR #64 (backupdokumentasjon) er ikke blandet inn.
- [Tilstandskart før endring](TILSTANDSKART.md) dokumenterer faktiske klientfelt, filer, nøkkel, forespørsel, kvittering og serverdata. Eksisterende atomisk `lagre_brev`, RLS, idempotens, utkast-CAS og sendt-snapshot videreføres.
- Ny kode er kontrollert mot lokale Next-guider for useRouter, use client og use server. Ingen nye avhengigheter.

## B. Endringer og begrunnelse

1. `src/components/useUlagretVern.ts`: felles vern for aktive ulagrede redigeringer, med beforeunload og capture av ordinære lenkeklikk. Nedlastinger, hashlenker, Mail og nye faner avbrytes ikke. Ingen skjult persistering.
2. `LeggTilBrevFlyt.tsx`: eksplisitt advarsel ved faktisk Avbryt/forlat, ikke ved vanlig metode- eller stegbytte. Ved ukjent lagring tilbys lenke til Saker. Eksisterende lås, nøkkel og identisk retry beholdes.
3. `utkast/UtkastFlyt.tsx`: automatisk sessionStorage-buffer for utkasttekst er fjernet. Bare den aktuelle eldre buffernøkkelen slettes ved åpning. Eksplisitt serverlagring består. Ulagret tekst finnes bare i aktiv React-tilstand.
4. Samme klient: synkron skrivelås stopper dobbelttrykk. Ukjent utkastlagring avklares mot serverversjon før nytt skriv. Lik lagret tekst gjenkjennes; annen versjon med annen tekst overskrives ikke. Ukjent sendtregistrering gir lesing først; negativ lesing foretar ikke automatisk ny registrering. Snapshot og låst sendttekst består.
5. `utkast/actions.ts`: ny lesende `hentUtkastStatus`, runtime-ID-kontroll og filtre på bruker, sak og utkast i tillegg til RLS. Transportfeil skilles fra sikkert avvist versjonsbetinget oppdatering. Ingen nye databasefunksjoner/rettigheter.
6. Faktisk nettleserfunn: Next-revalidering kan levere bekreftet sendtstatus selv om action-svaret tapes. UI lar den autoritative statusen overstyre gammel ukjent-beskjed. Synkron navigasjonsfeil etter sendtregistrering fremstilles ikke som ulagret.
7. `LagretBrevMerknad.tsx` og sakens `page.tsx`: kvittering etter Bestem senere viser saksnavn og de faktisk lagrede fristene fra eksisterende autentiserte spørringer, med dokumentlenke. Ingen ekstra spørring eller nye sensitive URL-felt.
8. `Bekreftelse.tsx`: navngitte datofelt/beløpsfelt, minst 44 px felt, 16 px redigeringstekst og brytbare store verdier. Dette reduserer en kjent iOS-fokuszoomrisiko, men er ikke fysisk iOS-bevis. Utkastets faselinje kan bryte til flere linjer.
9. Reprodusert ørefeil: formatering rundet til hele kroner, og telleanimasjonen overskrev presis SSR-verdi med avrundet sluttverdi. `format.ts` og `tell.ts` beholder nå registrert øre; regresjonstest feilet først og besto etter retting. Ingen saldo-/frist-/gebyrberegning endres.
10. Nye tester i `supabase/tests/r5-client.test.mjs`, `r5-belop.test.mjs` og `format.test.ts`. Eksisterende R3/R4-harness fikk nødvendige React-hookmocks; assertions beholdes. `scripts/r5-network-proxy.mjs` bryter et eksplisitt antall lokale forespørsler/svar uten å logge innhold eller cookies. `scripts/test-r5-status.mjs` tester faktisk statusmodul mot ekte bruker-JWT/PostgREST/RLS.

## C. Avbruddsmatrise

Tallet S/B/F/U betyr antall saker/brev/frister/utkast for den isolerte nettleserkontoen. Ingen produksjonsdata. Alle observerte tellinger gjelder denne runden.

| Scenario | Fremprovosering og klient | Autoritativ servertilstand | Resultat |
|---|---|---|---|
| Analysebrudd | Lokal proxy ødela socket før analyse-POST nådde server. Feil og opprinnelig tekst beholdt; ingen oppdiktet ferdiganalyse. Identisk tekst kunne leses etterpå. | Ingen ny lagring | Bestått i faktisk nettleser; syntetisk modelladapter, ikke modellkvalitet |
| Før brevlagring | Socket brutt før action ble videresendt. Klienten sa ukjent, ikke lagret; verdier/nøkkel beholdt, lenke til Saker. | S/B/F/U 1/1/0/1 før og etter | Bestått i faktisk nettleser |
| Etter brevlagring, svar tapt | Samme klientforsøk ble videresendt, hele serversvaret lest og deretter kastet av proxy. Ingen klientkvittering, verdier låst og samme nøkkel beholdt. | 1/1/0/1 → 2/2/1/1 | Bestått i faktisk nettleser |
| Retry etter tapt svar | Feilinnsprøyting oppbrukt; nytt identisk lagringskall fra samme fane. Serverbekreftet dokument ble åpnet. | 2/2/1/1 → 2/2/1/1 | Bestått; ingen duplikat |
| Gjenfinning/refresh | Åpnet Saker, riktig sak og siste brev; senere refresh av serverlagret sak. Ingen ny opplasting. | Samme dokument-ID; antall uendret av lesing | Bestått i faktisk nettleser |
| Utkastlagring, svar tapt | Etter-proxy på utkastaction. Lokal redigert tekst beholdt. Nytt forsøk leste status og gjenkjente lagret tekst. | Utkastversjon 1→2 ved første skriv, fortsatt 2 etter avklaring; sendt=false | Bestått i faktisk nettleser |
| Sendtregistrering, svar tapt | Etter-proxy på registreringsaction. Next-revalidering leverte autoritativ sendtstatus. Gammel motstridende melding ble rettet. | Versjon 2→3, sendt=true, snapshot=innhold; bare én registrering | Bestått i faktisk nettleser; ingen Mail eller kreditor-e-post sendt |
| Sendtstatus uten revalidering | Faktiske klienthandlere med tapt svar; separat statuslesing: sendt/ikke sendt/avvist. | Ingen ny skriv ved lesing; snapshot brukes ved sendt=true | Bestått i modultester, ikke nytt fysisk nettverksbevis |
| To ulike tekstversjoner | Faktisk klienthandler mottar høyere serverversjon med annen tekst | Lokal tekst beholdes; ingen ny update | Bestått i modultest. Ekte CAS/to-bruker-/parallelle tester i Supabase-suiten |
| Sikker avvisning vs transportfeil | Faktiske actions/klienthandlere: tom CAS-return, DB-feil, bekreftet data | Konflikt er eksplisitt avvist; transportfeil er ukjent og krever lesing | Bestått i modultester |
| Navigasjon feiler etter bekreftet brevlagring | R4s faktiske klienthandler med router som kaster, kjørt på nytt i full suite | Kvittering bevarer sak/brev-ID; ingen ny save | Bestått i modultest. Ikke uttømmende faktisk async Next-/hardnavigasjonsbrudd |
| Forkastingsdialog | Trykk Avbryt i faktisk nettleser startet bekreftelse, men IAB/CDP ble utilgjengelig i dialogforsøket. Ny testfane fungerte. | Ingen save startet; den prøven opprettet ikke brev | Ikke ferdig nettleserverifisert. Hooktest verifiserer preventDefault, lenkefiltrering og cleanup |
| Lukking før save | Ingen ny varig skjema-/filbuffer er innført | Ingenting å gjenfinne dersom server ikke har lagret | Dokumentert begrensning, ikke lovet gjenoppretting |

Et separat mørkt scenario lagret et nytt syntetisk brev med 1 234 567,89 kr, langt avsendernavn og eksplisitt frist 16. november. Antall ble 3/3/2/1. Etter Bestem senere var fristfunnet fortsatt synlig på saken (6 dager for kort), med forbehold om at dette ikke ugyldiggjør kravet. Etter animasjonen ble øre fortsatt vist. Betalingsforslag med 100 000 kr per måned ga eksisterende beregning: 13 måneder, siste avdrag 34 567,89 kr. Ingen betaling/avtale ble registrert.

Se [sanitert proxylogg](network-events.jsonl), [ekte status/RLS-prøver](status-rls.json) og [full integrasjonsrapport](supabase-resultat.json). Lokal nettlesertestkonto med tre saker, tre brev, to frister og ett utkast ble ryddet etter siste måling; ingen tokens eller brevtekst er tatt inn i loggene.

## D. Mobil og tilgjengelighet

Faktisk miljø: Windows, innebygd Chromium-nettleser, lokal Next-app med ekte test-Supabase og syntetisk loopback-modelladapter. **Ingen fysisk iPhone, iOS-tastatur, VoiceOver eller ekstern Mail/Notater-prøve er gjennomført i R5.**

- Alle tre steg ble kontrollert i lys/mørk visning, med retting, sumavvik, bekreftelse og fokus på ny H1.
- [Målte viewporter](viewport-metrics.json): 320, 390, 430 og 1280 CSS-px; ingen horisontal overflow på kontrollert Neste steg med kort frist. Fokus på SUMMARY etter kollaps; advarselen er synlig utenfor.
- Navngitte beløps-/datofelt er brukt i faktisk klient. Native datofelt ble verifisert med tastetrykk; fill alene i testverktøyet utløste ikke React-oppdateringen. Dette er ikke dokumentasjon på iOS-datovelgeren.
- 200 % faktisk nettleserzoom/iOS-stor tekst er **ikke bekreftet**. Ctrl+pluss ga ingen målt endring i IAB. Ingen kunstig CSS-skalering er presentert som fysisk zoomtest.
- Reduced motion dekkes av eksisterende faktiske komponenttester i fersk suite; ingen ny fysisk OS-/blinkmåling. Safe area og åpent mobiltastatur må fullføres fysisk.
- PR-bildene er uredigerte nettleseropptak av syntetiske data. 390 i filnavn er ønsket CSS-viewport; bildebufferen kan avvike. Det er målingene, ikke PNG-navnet alene, som viser CSS-bredden.

Bilder:
- [Kontroll lys](kontroll-390-lys.png), [Neste steg lys](neste-steg-390-lys.png).
- [Opplysninger mørk](opplysninger-390-mork.png), [Kontroll mørk](kontroll-390-mork.png), [Neste steg mørk](neste-steg-390-mork.png), [desktop mørk](neste-steg-desktop-mork.png).
- [Brevlagring ukjent](brev-ukjent-390.png), [bekreftet lagring med sak/frist](bestem-senere-kvittering-390.png), [gjenfunnet brev](gjenfunnet-brev-mork-390.png).
- [Utkastrespons tapt](utkast-ukjent-390.png), [sendt avklart](sendt-avklart-390.png), [analysebrudd](analyse-nettbrudd-390.png).
- [Kort-frist-varsel etter Bestem senere](kort-frist-etter-senere-mork-390.png), [betalingsforslag](betalingsforslag-mork-390.png), [svarinngang](svarinngang-mork-390.png).

## E. Brukertesting

0 faktiske eksterne deltakere. Ingen AI-simulering kalt brukertest. [Gjenbrukbar protokoll og anonymt observasjonsskjema](MANUELL_TESTPROTOKOLL.md) inkluderer alle 33 iPhone-steg og oppgavene til 3–5 uavhengige testpersoner. Ingen funn fra slike personer er påstått.

## F. Automatiserte tester

Ferske kjøringer, ikke gjenbruk av R4-tall:

| Kontroll | Resultat |
|---|---|
| npm test | 404/404; én ny ørepresisjonstest |
| node --test --test-concurrency=2 supabase/tests/*.test.mjs | 138/138; 21 nye R5-klient-/status-/animasjonstester. Lavere filparallellitet for lokalt minne; testenes egne samtidighetsassertions består |
| Ekte Supabase/HTTP | 26/26 bestått på kodecommit 9d803f3; cleanup=true; kun evvzxblhaxaraaurbhsu |
| Ekte statusmodul + PostgREST/RLS | 5/5, syntetisk oppsett/opprydding; egen, annen, anonym, feil sak, feil ID. Next createClient-adapter erstattet med ekte autentisert testklient; ikke separat HTTP-serialiseringstest |
| npm run lint | Bestått, 0 feil; én eksisterende advarsel i ignorert lokal release-worktree |
| npx tsc --noEmit | Bestått |
| npm run build | Bestått lokalt, 22 sider generert; ingen deploy |
| npm audit --omit=dev | 0 sårbarheter, uendret lockfile |

Ingen skip, svekkede assertions, nye pakker eller deaktiverte lintregler.

## G. Sikkerhet og bevisste begrensninger

Ingen ny lokal persistering, filopplastingstjeneste, tabell, RLS-policy eller migrasjon. Autoritativ status leses med auth.getUser og eksplisitt utkast/sak/brukerfilter; snapshot foretrekkes. Ny lesing krever ikke service-role. Ekte bruker-JWT/RLS-test av annen bruker returnerte ingen tekst. Testadministrator brukes bare til syntetisk oppsett og opprydding.

Den eldre automatiske sessionStorage-tekstbufferen er fjernet. Bare aktuell gammel nøkkel slettes ved åpning; dette er ikke en påstand om at gamle faner/andre enheter er fullstendig fjernslettet. Serverlagret utkast gjenåpnes fortsatt; **ulagret tekst som bare fantes i gammel buffer importeres ikke**. Dette er en bevisst personvernbegrensning. Ingen nye klientlogger med innhold.

[Separat vurdering av varig kladd](VARIG_KLADD_VURDERING.md) beskriver dataminimering, RLS, utløp, sletting, utlogging/kontosletting, delt enhet, kryptering og atomisk fullføring. Ikke implementert uten godkjenning.

beforeunload er best effort: mobil-OS kan avslutte fanen uten hendelse, og browser Tilbake/programmatisk ruting kan ikke fanges sikkert med bare lenkecapture. Ingen history-hacking eller global router-patching er innført. Async navigasjonsfeil med hard browserfallback er ikke fullstendig løst av en React-kvittering; gjenfinning fra autentisert Saker er fortsatt sikker vei når nettet er tilbake. Ingen garanti om å gjenopprette ulagret arbeid etter lukking.

## H. Endelig anbefaling

1. **Lagret brev kan gjenfinnes?** Ja, testet fra Saker til eksakt dokument under autentisert eierskap, uten ny lagring.
2. **Ukjent resultat?** Ja i aktiv fane: ærlig melding, låst payload, samme nøkkel; utkast og sendtstatus leses før nytt skriv.
3. **Duplikater ved retry?** Eksisterende serveridempotens består. Faktisk tapt svar/retry ga uendrede antall. Ny opplasting etter lukking får ny nøkkel; brukeren må først se etter brevet.
4. **Ulagrede endringer i aktiv fane?** Ja ved stegbytte og testede feil; eksplisitt lagring kreves før lukking.
5. **Refresh/lukking før lagring?** Ulagret React-tilstand og lokale filer kan gå tapt. Ingen automatisk dokumentpersistens er innført.
6. **Fysisk iPhone?** Ikke testet i R5. Protokoll levert; tidligere bevis er ikke gjenbrukt.
7. **Skjermleser?** Semantikk, navngitte felt, fokus og varsler er kontrollert i kode/komponent/Chromium-AX; full VoiceOver-reise er ikke bevist.
8. **Tre valg forståelige?** Konkrete norske tekster og felles lagringsforklaring består. Reell forståelse hos utenforstående må testes med protokollen.
9. **Trygt å merge?** Kandidat til gjennomgang etter R4 og etter grønn CI, med eksplisitte begrensninger. Ingen automatisk merge/deploy; ikke en påstand om full privat-beta-godkjenning.
10. **Før privat beta?** Fullfør fysisk iPhone/Safari med tastatur/VoiceOver/zoom/Mail, ekstern brukertest og vurder navigasjons-/lukkegrensene. Ikke bruk klientadvarsler som garanti mot datatap.
