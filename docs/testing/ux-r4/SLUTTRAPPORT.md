# UX R4 – sluttrapport

Utgangspunkt: `main` 901d0a9 (PR #65). Arbeidsgren: `codex/ux-r4-trygg-lagring`. Ingen merge, manuell produksjonsdeploy, produksjonsmiljøendring eller migrasjon er utført i R4. Åpen PR #64 er separat dokumentasjonsarbeid og er ikke tatt med.

## A. Før endring

Full kartlegging før UI-endringer: [LAGRINGSKART.md](LAGRINGSKART.md).

- Alle redigerte dokumentopplysninger, bekreftelser, sak-/fristvalg og huskeliste finnes i klienten frem til en handling velges. Stegbytte lagrer ingenting.
- Alle tre handlinger kaller samme `lagreBrev`. Eksisterende `lagre_brev` oppretter/velger sak og lagrer brev, frister, fristerstatning og steg atomisk, med serverkontroll og idempotensnøkkel.
- Svar og betalingsvalg navigerer etter serversuksess. Utkastgenerering starter senere ved et eget trykk. «Bestem senere» oppretter ikke utkast. Ingen handling sender e-post automatisk.
- Nøkkelen beholdes i samme fane ved retry, men skjema/nøkkel er ikke varig lagret gjennom lukking/refresh. Det loves ikke automatisk gjenoppretting.

Påviste forbedringsbehov: det tredje valget var lite synlig; lagringstidspunktet var utydelig; kort frist kunne skjules ved kollaps; dobbelttrykk kunne starte flere klientkall; serversuksess hadde ingen stabil klientkvittering ved navigasjonsfeil; dokument-ID fra RPC-et ble ikke sendt videre til svar-/betalingsflyt. Under testing ble også avrundet ørevisning og for kategorisk «ikke lagret»-tekst ved ukjent resultat rettet.

## B. Implementert

### Handlingsvalg og tekster

- Beholder Opplysninger → Kontroll → Neste steg og eksisterende designsystem.
- Tre kort med samme oppbygging: «Svar på kravet», «Finn en betalingsløsning», «Bestem senere».
- Oppgir før valget at brevet ikke er lagret, og at alle valg lagrer brev, valgte frister og huskeliste først. Under lagring vises venting; ved tapt svar oppgis ukjent resultat. Ingen av disse tilstandene kalles «lagret» uten serversuksess.
- «Lag et svar du kan lese gjennom, endre og sende selv», «Se muligheter for avdrag eller å be om mer tid» og «Lagre brevet og kom tilbake når du vil» beskriver faktiske videre flyter.

### Sak, frister og kontroll

`SakOgFrister.tsx` viser valgt sak, bare faktisk valgte frister, nærmeste valgte dato eller «Ingen frister valgt for lagring». Kort frist og alvorlig varsel vises utenfor accordion. Særskilte bekreftelser for utfall/gjenåpning, erstattede frister og historisk overskriving ligger fortsatt synlige utenfor den lukkede gruppen.

Kontrolloversikten skiller ukontrollerte linjer fra kontroll mot kjente beløpsgrenser. Ingen kontroll eller ingen merknad fremstilles som juridisk godkjenning av hele kravet. Eksisterende detaljvisning, forklaringer og forbehold beholdes.

### Minimale pålitelighetsrettelser

- Synkron klientlås hindrer to lagringskall før rerender. Den frigis ved feil der retry er mulig; eksisterende serveridempotens er uendret.
- Ved uavklart forsøk låses redigerbare verdier og lagringsvalg, slik at retry ikke kombinerer gammel nøkkel med nye rettelser. Handlingskortene kan fortsatt brukes til retry, og opplysningene kan leses. Serverens uttrykkelige kontrollavvisning åpner for ny bekreftelse.
- `LagreBrevResultat` viderefører RPC-ets eksisterende `brev_id`. Svar- og betalingsruter får eksplisitt brevparameter. Betalingssiden krever at dette brevet finnes i den innloggede brukerens valgte sak; ingen fallback til et annet brev ved uriktig kobling. Saksbeløpet er fortsatt autoritativt.
- `LagretBrev.tsx` er stabil kvittering mens navigasjonen starter, med lenker til neste side, sak og dokument ved svikt. Destinasjonssidene viser lagringsmerknad bare etter at dokumentet er funnet i den autentiserte saksspørringen.
- Betalingssiden viser øre uten å endre saldo eller avdragsberegning. Genererings-/sendefeil kan annonseres med `role="alert"`.

### Tilgjengelighet

Semantiske knapper, native details/summary, tastaturfokus og minst 44 px trykkflater videreføres. Ikoner i kortene er dekorative; tekst forklarer valgene. Felt låses under lagring. Feil er tilgjengelige som varsler. Bildereferansefeil påvirker ikke redigerte verdier. Ingen nye avhengigheter, store layoutanimasjoner eller juridiske terskler.

Endrede produktfiler: `Veivalg.tsx`, `BrevGjennomgang.tsx`, `LeggTilBrevFlyt.tsx`, `KontrollOversikt.tsx`, `SakOgFrister.tsx`, `BrevReferanse.tsx`, `LagretBrev.tsx`, `LagretBrevMerknad.tsx`, `legg-til-brev/actions.ts`, sakens `page.tsx`, utkastets `page.tsx`/`UtkastFlyt.tsx` og betalingssidens `page.tsx`.

## C. Tester fra denne R4-runden

| Kontroll | Resultat og avgrensning |
|---|---|
| `npm test` | 403/403 bestått |
| Lokale database-/modultester | 117/117 bestått: `node --test --test-concurrency=2 supabase/tests/*.test.mjs`. Standard parallellkjøring samtidig med bygg traff lokal V8-minnegrense; samme tester besto separat, uten endrede assertions. |
| Ekte Supabase + lokal HTTP | 26/26 bestått på kodecommit 1df680c; ekte bruker-JWT, riktig testprosjekt og cleanup=true. Se [supabase-resultat.json](supabase-resultat.json). |
| `npm run lint` | Bestått med 0 feil og én eksisterende advarsel i den ignorerte release-worktreen. Ingen ny regel er slått av. |
| `npx tsc --noEmit` | Bestått; endelig produksjonsbygg inkluderer også typekontroll. |
| `npm run build` | Bestått, 22 sider generert; ingen deploy |
| Nettleser | Faktisk lokal app med syntetisk modelladapter og ekte test-Supabase; se scenarioer nedenfor |
| Fysisk mobil/skjermleser | Ikke kjørt på nytt i R4. Tidligere iPhone-resultater regnes ikke som nye R4-bevis. |

Ved første kjøring oppstod EPERM i sandboxen; samme uendrede testsuite ble kjørt med tilgang til installerte filer. En senere parallell kjøring sammen med produksjonsbygg traff lokal V8-minnegrense i PGlite-prosesser. Den samme suiten er derfor kjørt separat med `node --test --test-concurrency=2 supabase/tests/*.test.mjs`. Dette endrer bare antall testfiler som startes samtidig, ikke testenes interne parallelle SQL/RLS-forsøk, assertions eller antall tester.

De nye klient-/rutetestene kjører den faktiske implementasjonen med kontrollerte React-/servergrensesnitt, ikke en alternativ lagringsmotor. De dekker alle tre mål, nye/eksisterende saker, ørebeløp, lås før rerender, serverfeil/nettverk/timeout, samme nøkkel ved retry, synkron navigasjonsfeil, utdatert bekreftelse, alvor/kort frist utenfor details, eksplisitt dokumentkobling, gjenåpning og særskilt avslutningsbekreftelse. Databaseintegrasjonene er et separat bevis og omtales ikke som klienttestene.

### Faktiske nettleserscenarioer

1. **Bestem senere, eksisterende sak:** total rettet 1288→289 ga sumavvik og sperre; rettet tilbake og bekreftet. Kontroll/forbehold og detaljer åpnet. Eksisterende sak og frist valgt, seksjon lukket, tilbake/frem med bevarte valg. Proxy slapp serverlagringen gjennom og brøt responsen. Før retry: 1 sak, 2 brev, 1 frist og 1 eldre fixtureutkast. Etter retry: identiske antall, lagringsmerknad og riktig dokument i saken. Ett nytt brev, ikke duplikat.
2. **Svar, isolert konto og ny sak:** lagret brev før overgang til utkast med samme eksplisitte dokument-ID. Generering kjørt med syntetisk feiladapter og ga forståelig feil. Brev og sak ble beholdt; ingen ny sendt-status eller nytt ferdig utkast ble lagret. Mottaker-/dokumentkobling verifiseres også i faktisk side-/servermodulregresjon; ikke via sendt e-post.
3. **Betaling, isolert konto og ny sak:** langt avsendernavn, total 1 234 567,89 kr, hovedstol 1 234 529,89 kr og eksplisitt kort frist 15. november. Advarsel forble synlig etter Space-kollaps, med fokus på SUMMARY. Riktig brev-ID i betalingsruten. Eksisterende beregning viste 100 000 kr/mnd over 13 måneder, siste avdrag 34 567,89 kr. Videre til forespørselsutkast bevarte brev-ID. Ingen betaling, avtalegodkjenning eller sendt-registrering.
4. **Lukking under pågående lagring:** fane lukket før klientkvittering mens serveren lagret. Etter åpning av Saker fantes brevet i ny sak; 2 saker/2 brev inkludert én eksisterende fixture. Ingen automatisk skjemaoppretting eller ny lagring ved gjenåpning.
5. **Endelig ukjent-tilstand og lås:** ny isolert konto, tapt svar etter faktisk lagring. Melding om ukjent resultat, låst «Å betale» ved retur til Opplysninger, fortsatt lesbare verdier og tilgjengelig retry. Etter retry ble samme lagrede dokument åpnet, og antall forble 2 saker/2 brev/1 frist inkludert fixture.

Hver hovedprøve brukte egen syntetisk konto; alle kontoene er ryddet. Modellen var en lokal feil-/analyseadapter, ikke et mål på faktisk modellkvalitet. Ekte e-post, betaling og produksjonsdata er ikke brukt.

## D. Visuelt bevis

Bildene er faktiske nettleserbilder, uten etterbehandling. `for-*` er kopier av PR #65-baseline og er merket historisk. Etter-bildene bruker isolerte syntetiske data; stresstestbeløp/datoer er ikke identiske i alle før-/etter-par. Filnavn med 390 angir ønsket CSS-viewport. IAB kan skalere eller beskjære PNG-utdata; faktiske bildedimensjoner føres i `bildedimensjoner.json`. Skjermbreddebeviset er DOM-målingene, ikke en antatt PNG-bredde.

- [Opplysninger, lys](opplysninger-390-lys.png) og [mørk](opplysninger-390-mork.png).
- [Kontroll, lys](kontroll-390-lys.png) og [mørk](kontroll-390-mork.png).
- [Neste steg, lys](neste-steg-390-lys.png) og [mørk](neste-steg-390-mork.png): alle tre alternativer.
- [Åpne lagringsvalg](sak-frister-apen-390.png).
- [Ukjent lagringsresultat](lagringsfeil-390.png).
- [Lagret ved Bestem senere](bestem-senere-lagret-390.png), [svargrunnlag](svar-etter-lagring-390.png), [genereringsfeil](utkast-genereringsfeil-390.png).
- [Betalingsforslag](betaling-forslag-390.png), [forespørselsutkast](betaling-utkastgrunnlag-390.png), [gjenfunnet etter lukking](gjenfunnet-etter-lukking-390.png).
- [Desktop, mørkt tema](neste-steg-desktop-mork.png).
- [Målte CSS-bredder](viewport-metrics.json): 320, 375, 390, 430, 768 og 1280, uten horisontal overflow på kontrollert Neste steg. Fokus var på H1 etter stegbytte. Dette er viewport-emulering, ikke fysisk mobiltest.

## E. Gjenstående begrensninger

- Fysisk iPhone/Safari med tastatur, iOS stor systemtekst, zoom, VoiceOver og redusert bevegelse er ikke gjentatt i R4. Native mobilkamera, bilde-/PDF-opplasting og PDF-nedlasting er heller ikke nytestet her.
- Redusert bevegelse er dekket av eksisterende komponenttester; ingen ny fysisk OS-prøve eller instrumentert måling av svart blink gjøres gjeldende.
- Ingen garanti om gjenoppretting av ulagret klienttilstand etter refresh/lukking. Ny manuell opplasting etter lukking får ny nøkkel; brukeren instrueres om å se etter brevet i Saker først.
- Lagringskvittering/lenker og synkron routersvikt er modulprøvd. Alle mulige asynkrone Next-rutefeil, nettlesercrash og nettverksutfall på enhver pakke er ikke uttømmende testet.
- Mange gebyrer/ukontrollerte linjer og særskilte utfall er modul-/regresjonsprøvd, ikke alle gjentatt som fysiske nettleserscenarioer. Bildereferansens feiltilstand er kode-/typekontrollert; ingen ny fysisk ødelagt bildefil er lastet opp.
- Eksisterende dev-lintadvarsel i lokal release-worktree er ikke skjult eller ryddet utenfor oppgaven.

## F. Endelig vurdering

1. **Når lagres brevet?** Tydelig: først ved handlingsvalg, lagret-tekst først etter serverbekreftelse; venting og ukjent resultat er egne tekster.
2. **Sendes noe automatisk?** Nei. UI og kontroller skiller lagret brev, utkast og særskilt sendt-registrering.
3. **Tre forståelige alternativer?** Ja, tre likeverdige kort med konkret neste handling og felles lagringsforklaring.
4. **Viktige frister ved lukket seksjon?** Ja, kort-frist-/alvorsvarsel ligger utenfor, og bare valgte frister listes i oppsummeringen.
5. **Bevares opplysninger og valg?** Ja ved frem/tilbake og feil i samme fane. Utdaterte bekreftelser nullstilles; ukjent forsøk låser rettelser til retry er avklart.
6. **Trygg lagring ved feil/retry?** Bekreftet for testede scenarioer med eksisterende atomisk RPC og nøkkel, inklusive faktisk mistet svar og ingen duplikat. Begrensningen ved lukket/nyopprettet skjema står ovenfor.
7. **Lys/mørk modus?** Kontrollert i faktisk desktopnettleser og emulerte mobilbredder, uten påstand om ny fysisk Safari-/VoiceOver-godkjenning.
8. **Merge etter godkjenning?** Anbefalt for kodegjennomgang og godkjenning som avgrenset R4-endring med oppgitte begrensninger. Ingen automatisk merge eller produksjonsdeploy. Full fysisk mobilgodkjenning må vurderes separat.
