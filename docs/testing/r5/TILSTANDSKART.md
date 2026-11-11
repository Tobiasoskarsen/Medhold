# R5: faktisk utgangspunkt og tilstandskart

10. november 2026. `main` er 901d0a9. R4 PR #66 er åpen med grønn CI og preview, head d29d3f9. R5 bygger på denne i egen gren og PR mot R4-grenen. PR #64 er separat backupdokumentasjon. Ingen nye commits på main etter R4s base.

| Tilstand | Hvor lagret før R5 | Refresh | Lukking | Gjenfinning |
|---|---|---|---|---|
| Opplastet bilde/PDF | React/base64 i aktiv fane | Nei | Nei | Originalfil på brukerens enhet, ikke apparkiv |
| Innlimt tekst, OCR/analyse | React | Nei | Nei | Etter lagring: original_tekst i brev under RLS |
| Rettede beløp, hovedstol, gebyrer, dato, frist, avsender/e-post, saksnummer | React | Nei | Nei | Bare etter eksplisitt lagring |
| Bekreftelser og sak-/frist-/huskelistevalg | React | Nei | Nei | Lagret del av eksisterende atomisk RPC; ikke som uferdig skjema |
| Neste handling | Kallets lokale variabel | Nei | Nei | Ikke varig lagret; dokumentet kan åpnes fra Saker |
| Idempotensnøkkel | React, én UUID per analyse | Nei | Nei | Samme nøkkel ved retry i aktiv fane |
| Pågående/ukjent lagring | React + eksisterende servertransaksjon | Klientstatus nei | Klientstatus nei | Serverlagret brev i autentisert sakshistorikk |
| Bekreftet sak-ID/brev-ID/kvittering | React; lagret-parameter og autentisert destinasjon | Destinasjon ja | Via Saker | RLS + sak-/brevfilter |
| Redigert utkast | React + eldre automatisk sessionStorage-buffer | Buffer kan overleve | Ikke garantert | Serverversjon etter eksplisitt lagring |
| Sendt-snapshot | Eksisterende RPC/database | Ja | Ja | Autentisert utkast; uforanderlig snapshot |

## Avgrenset plan og trusselbilde

1. Navigasjonsvern for aktivt ulagret arbeid og tydelig vei til Saker ved ukjent resultat. Ingen ny persistering av dokumenter eller nøkkel.
2. Fjern eksisterende automatisk utkasttekst-buffer fra sessionStorage; slett bare den aktuelle gamle buffernøkkelen ved åpning. Delt enhet/XSS/nettleserutvidelser får ellers en ekstra kopi av økonomiske opplysninger. Serverlagret tekst og vanlig React-tilstand beholdes.
3. Ved ukjent sendtregistrering skal neste handling lese autoritativ status med bruker-, sak- og utkastfilter før eventuell ny registrering. Sperr samtidig dobbelklikk. Behold CAS og snapshot-reglene.
4. Kvitteringer etter Bestem senere skal bruke eksisterende autentiserte saks-/fristdata. Ingen ny databasekolonne eller sensitive URL-parametre.
5. Automatiserte klient-/DB-/HTTP-tester og nettleserbevis. Fysisk iPhone, VoiceOver og eksterne testpersoner kan ikke erklæres bestått uten faktisk bevis; lever protokoller.

Originalfiler sendes til analyse, men finnes ikke i Supabase Storage i denne flyten. Brevradens tekst/fakta lagres ved eksplisitt valg; kontosletting og eierskapsregler forblir uendret. Eksisterende kvitteringsmarkør i sessionStorage inneholder bare `1`, ikke brevtekst. R5 innfører ikke service worker-cache eller annen lokal dokumentlagring.
