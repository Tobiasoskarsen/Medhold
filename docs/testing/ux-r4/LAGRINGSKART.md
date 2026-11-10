# UX R4 – lagringskart før UI-endringer

Utgangspunkt: main 901d0a9, PR #65 merget. Åpen PR #64 gjelder separat backup-/release-dokumentasjon og er ikke inkludert i R4. Brukerens ucommittede gjennomgangsfil beholdes.

1. Klient: dokumentdata, redigerte beløp/datoer/linjer, bekreftelser, valgt sak, frister/erstattede frister, huskeliste, utfall og lagringsnøkkel ligger i LeggTilBrevFlyt. Stegbytte lagrer ingenting. Nøkkelen opprettes ved analyse, beholdes ved retry, men er ikke varig lagret ved lukking/refresh.
2. Alle tre valg kaller lagre(destinasjon). lagreBrev kontrollerer innlogging, runtime-input, obligatorisk bekreftelse/sumavvik, eierskap, samtidighetsgrunnlag, serverberegnet alvorlighet og fristfunn. Det eksisterende RPC-et lagre_brev oppretter ny sak eller knytter til eksisterende sak, oppretter brev, frister, erstattelsesmarkeringer og steg atomisk. Nøkkelen håndhever idempotens.
3. Avledet hovedstolavvik oppdateres etter transaksjonen. Deretter revalideres sider og serveren svarer med sakId. RPC-et har også brev_id, som klientresponsen hittil har utelatt.
4. Svar: lagring først, så /krav/{sak}/utkast?type=innsigelse. Generering starter ved eget trykk i UtkastFlyt og lagrer utkast etter kontroll. Utkast er ikke sendt; sendt-status krever særskilt handling med snapshot.
5. Betaling: lagring først, så /krav/{sak}/veier-ut. Eksisterende sakssaldo og autoritativ avdragsberegning brukes. Forespørselen/utkastet opprettes i senere steg, ingen avtale eller betaling inngås.
6. Senere: lagring først, så saksdetaljen med brev i historikken. Ingen utkastgenerering.
7. Nettverksfeil: verdier og nøkkel beholdes i samme fane; serverens idempotens beskytter retry. Ved lukking kan lagringen ha gått gjennom, men klienten garanterer ingen automatisk gjenoppretting. Lagret brev finnes i Saker. Ukjent resultat må ikke omtales som sikkert mislykket.
8. Påviste rettelsesbehov: ingen synkron klientlås mot dobbelttrykk før React-rerender; ingen vedvarende lagringsbekreftelse/fallback når navigasjon feiler; svarnavigasjon utelater lagret brevId og kan derfor velge et annet brev ved historisk opplasting. Betalingssiden velger også nyeste brev uten eksplisitt parameter. R4 retter dette minimalt uten DB-endring.

Filer: LeggTilBrevFlyt.tsx, BrevGjennomgang.tsx, KontrollOversikt.tsx, Bekreftelse.tsx, Veivalg.tsx, legg-til-brev/actions.ts, krav/[id]/utkast/{page.tsx,UtkastFlyt.tsx}, krav/[id]/veier-ut/{page.tsx,VeierUtFlyt.tsx}, migrasjon 0027 (leses, endres ikke).

Plan: separate commits for handlingskort/tekster, sak-/fristoppsummering og synlige varsler, minimale lagrings-/dokumentkoblingsrettelser, tilgjengelighet og responsivitet, deretter regresjonstester/nettleserbevis/sluttrapport. Ingen merge, produksjonsdeploy, produksjonsmiljøendring eller migrasjon i R4.
