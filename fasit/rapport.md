# Fasitrapport

Generert av `scripts/fasit-lesing.ts` og `scripts/fasit-utkast.ts`
(MEDHOLD_SIKKERHET_ARBEIDSORDRE §E.3–E.4). Ikke rediger for hånd — kjør
skriptene på nytt.

<!-- lesing:start -->
## Lesing av brev (§E.3)

Sist kjørt: 4.11.2026, 15:44:38. Forventet-filer: 1. Lest: 0.

### Ikke lest

- testbrev_13.pdf: PDF mangler i fasit/brev/
<!-- lesing:slutt -->

<!-- rente:start -->
## Lesing av renteperiode og sats (Del B)

Sist kjørt: 11.11.2026, 22:19:10. 8 syntetiske brev × 20 kjøringer. Lest: 160. Lesefeil (kall feilet): 0.

| Brev | Lest | renteFra feil | renteTil feil | rentesats feil | beløp feil | linje mangler | Kjøringer med minst én feil |
|---|---|---|---|---|---|---|---|
| rente_1.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_2.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_3.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_4.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_5.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_6.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_7.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |
| rente_8.txt | 20 | 0 | 0 | 0 | 0 | 0 | 0 |

Kjøringer med minst ett feil rentefelt, beløp eller manglende linje: 0 av 160 (ca. 0.0 per 20).
Kjøringer der appens vurdering avvek fra fasit: 0.

Grense (arbeidsordre): «over» på renter kan først slås på når lesingen er feil i høyst 1 av 20. Status: innenfor grensen. RENTE_KAN_VAERE_OVER = false.
<!-- rente:slutt -->

<!-- utkast:start -->
## Utkast (§E.4)

Sist kjørt: 4.11.2026, 15:49:46. Scenarioer: 20. Generert: 20.

**Uten advarsler etter regenerering: 20/20.** Regenerert: 1.

Ordtall: snitt 88, min 55, maks 129.

| Scenario | Kategori | Ord | Regenerert fordi | Advarsler etterpå |
|---|---|---|---|---|
| delvis-1 | innsigelse_delvis | 84 | — | ingen |
| delvis-2 | innsigelse_delvis | 75 | — | ingen |
| delvis-3 | innsigelse_delvis | 83 | — | ingen |
| delvis-4 | innsigelse_delvis | 80 | — | ingen |
| delvis-5 | innsigelse_delvis | 76 | — | ingen |
| delvis-6 | innsigelse_delvis | 93 | — | ingen |
| helt-1 | innsigelse_helt | 101 | — | ingen |
| helt-2 | innsigelse_helt | 125 | — | ingen |
| helt-3 | innsigelse_helt | 117 | — | ingen |
| helt-4 | innsigelse_helt | 87 | — | ingen |
| nedbetaling-1 | nedbetaling | 76 | — | ingen |
| nedbetaling-2 | nedbetaling | 80 | — | ingen |
| nedbetaling-3 | nedbetaling | 85 | — | ingen |
| nedbetaling-4 | nedbetaling | 82 | — | ingen |
| utsettelse-1 | utsettelse | 55 | — | ingen |
| utsettelse-2 | utsettelse | 60 | — | ingen |
| utsettelse-3 | utsettelse | 62 | — | ingen |
| pastand-1 | egne_pastander | 86 | — | ingen |
| pastand-2 | egne_pastander | 114 | Personen har ikke skrevet at hen ikke har mottatt noe. Fjern påstanden. | ingen |
| pastand-3 | egne_pastander | 129 | — | ingen |

### Utkastene

<details><summary>delvis-1</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen deres datert 14. oktober 2026, saksnummer NI-2026-11872.

Hovedstolen på 2 400 kr og 750 kr av inkassosalæret er jeg enig i. Dette utgjør 3 150 kr, som jeg betaler innen fristen.

De resterende 50 kr av inkassosalæret er jeg uenig i. Høyeste lovlige sats er 750 kr, og kravet overstiger denne satsen med 50 kr. Denne delen av kravet er omtvistet til den er korrigert.

Send meg et korrigert krav der salæret er rettet opp.

Vennlig hilsen
Ola Nordmann
```

</details>

<details><summary>delvis-2</summary>

```
Hei,

Jeg har mottatt inkassovarselet datert 6. oktober 2026, fakturanummer 2026-004417.

Purregebyret på 70 kr er jeg uenig i. Resten av kravet betaler jeg.

Purregebyret virker for høyt. Høyeste lovlige sats er 38 kr, og gebyret overstiger dermed maksimalsatsen med 32 kr.

Jeg betaler den ubestridte delen på 1 326 kr innen fristen.

Send meg et korrigert krav med riktig purregebyr. Ikke legg til flere gebyrer før dette er rettet opp.

Vennlig hilsen
Kari Eksempel
```

</details>

<details><summary>delvis-3</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen deres datert 9. oktober 2026, kundenummer 88213, faktura 2026-1190.

Hovedkravet på 5 600 kr er jeg enig i. Jeg betaler den ubestridte delen på 5 713 kr innen fristen.

Betalingsoppfordringsgebyret på 180 kr er jeg delvis uenig i. Høyeste tillatte sats etter inkassoforskriften er 113 kr for et krav i denne størrelsen. Gebyret ligger dermed 67 kr over lovlig maksimalsats, og disse 67 kronene er omtvistet.

Send meg et korrigert krav med riktig gebyr.

Vennlig hilsen
Per Hansen
```

</details>

<details><summary>delvis-4</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen fra Akersgata Inkasso, saksnr. AI-2026-30455, datert 12. oktober 2026.

Jeg er enig i selve regningen fra tannlegen. Den ubestridte delen av kravet, 9 538 kr, betaler jeg innen fristen.

Inkassosalæret på 1 900 kr er jeg delvis uenig i. Høyeste lovlige sats er 1 500 kr, og salæret overstiger dermed maksimalsatsen med 400 kr. Disse 400 kronene bestrider jeg.

Send meg et korrigert krav der salæret er rettet til lovlig sats.

Vennlig hilsen
Lise Berg
```

</details>

<details><summary>delvis-5</summary>

```
Hei,

Jeg har mottatt inkassovarselet datert 15. oktober 2026, kundenr. GS-77120.

Utestående beløp på 890,50 kr er jeg enig i. Inkassovarselgebyret på 65 kr er jeg delvis uenig i. Jeg betaler derfor 928,5 kr innen fristen.

Høyeste lovlige sats for inkassovarselgebyr er 38 kr. Gebyret på 65 kr overstiger denne satsen med 27 kr. Denne delen av kravet er omtvistet til den er korrigert.

Send meg et korrigert krav med riktig gebyr.

Vennlig hilsen
Ahmed Rahimi
```

</details>

<details><summary>delvis-6</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen fra Vestland Krav AS datert 7. oktober 2026, saksnummer VK-2026-6021.

Jeg er delvis uenig i kravet. Den ubestridte delen, 1 594,25 kr, betaler jeg innen fristen 21. oktober 2026.

Purregebyret på 75 kr overstiger høyeste lovlige sats på 38 kr, en differanse på 37 kr. Inkassosalæret på 700 kr overstiger høyeste lovlige sats på 656,25 kr, en differanse på 43,75 kr. Til sammen utgjør dette 80,75 kr, som jeg bestrider.

Send meg et korrigert krav der purregebyr og inkassosalær er satt til lovlig nivå.

Vennlig hilsen
Mari Solheim
```

</details>

<details><summary>helt-1</summary>

```
Hei,

Jeg har mottatt inkassovarselet deres datert 13. oktober 2026, kundenummer 451190, med krav på 1 535,00 kr.

Jeg bestrider kravet i sin helhet.

Jeg har aldri bestilt abonnementet på Ukeblad Direkte som kravet gjelder. Det er dermed ikke noe avtaleforhold mellom meg og dere for perioden juli til september 2026.

Jeg ber om at dere:
- sender meg avtalen kravet bygger på, inkludert dato og metode for bestilling
- stanser videre inndriving til dette er dokumentert
- bekrefter skriftlig at saken er satt på vent i mellomtiden

Blir ikke bestillingen dokumentert, regner jeg kravet som bortfalt.

Vennlig hilsen
Jonas Lie
```

</details>

<details><summary>helt-2</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen fra Nordvik Inkasso AS datert 8. oktober 2026, saksnummer NI-2026-12904.

Jeg er uenig i kravet og betaler det ikke.

Kravet gjelder medlemskap for august og september 2026. Jeg sa opp medlemskapet hos Spenst Trening AS 30. juni 2026 og har e-postbekreftelse på oppsigelsen. Medlemskapet skulle dermed vært avsluttet før august, og det er ikke grunnlag for å fakturere meg for disse månedene.

Siden hovedkravet bestrides, faller også inkassovarselgebyret på 38 kr og inkassosalæret på 300 kr bort. Jeg ber om at dere:

- registrerer kravet som omtvistet og stanser videre inndriving
- bekrefter dette skriftlig
- enten avslutter saken eller sender den til forliksrådet, hvis dere mener kravet står seg

E-postbekreftelsen sender jeg gjerne ved behov.

Vennlig hilsen
Nora Dahl
```

</details>

<details><summary>helt-3</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen fra Akersgata Inkasso AS datert 16. oktober 2026, saksnr. AI-2026-31877.

Jeg bestrider hele kravet knyttet til ordre 2026-55102.

Jeg har aldri fått varen. Pakken ble returnert til avsender. Det er derfor ikke grunnlag for å kreve betaling for en vare jeg ikke har mottatt.

I tillegg er purregebyret på 70 kr satt for høyt. Høyeste lovlige sats er 38 kr, altså 32 kr mindre enn det som er krevd.

Kravet er omtvistet i sin helhet. Jeg ber om at dere:
- stanser videre inndriving
- bekrefter skriftlig at saken er satt på vent
- dokumenterer at varen faktisk ble levert til meg, hvis dere mener kravet står seg

Vennlig hilsen
Erik Moe
```

</details>

<details><summary>helt-4</summary>

```
Hei,

Jeg har mottatt inkassovarselet deres datert 5. oktober 2026, saksnummer knyttet til målepunkt 707057500012345678.

Jeg bestrider kravet. Jeg flyttet inn i boligen 1. september 2026, og kravet gjelder strømforbruk for august 2026.

Forbruket må derfor tilhøre forrige leietaker, ikke meg. Jeg hadde ikke innflytting eller noe kundeforhold til målepunktet i august.

Jeg ber om at dere:
- undersøker hvem som var kunde på målepunktet i august 2026
- sender kravet til riktig person
- bekrefter skriftlig at saken mot meg er avsluttet

Vennlig hilsen
Sofie Lund
```

</details>

<details><summary>nedbetaling-1</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen fra Nordvik Inkasso AS datert 19. oktober 2026, saksnummer NI-2026-13310. Kravet på 4 800,00 kr bestrides ikke, og jeg vil gjøre opp for meg.

Jeg har ikke mulighet til å betale hele beløpet innen fristen 2. november 2026. Jeg foreslår derfor 600 kr i måneden i åtte måneder, med siste avdrag på 600 kr.

Bekreft skriftlig om nedbetalingsavtalen godtas. Sett innbetalingen på vent til dere har svart.

Vennlig hilsen
Thomas Bakke
```

</details>

<details><summary>nedbetaling-2</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen fra Vestland Krav AS datert 20. oktober 2026, saksnummer VK-2026-6544. Kravet på 3 243,00 kr er riktig, og jeg vil gjøre opp for meg.

Jeg har nettopp mistet jobben og kan ikke betale hele beløpet innen fristen 3. november 2026. Jeg foreslår derfor 500 kr i måneden i sju måneder, med et siste avdrag på 243 kr.

Bekreft skriftlig om dere godtar forslaget. Sett innkrevingen på vent til dere har svart.

Vennlig hilsen
Ingrid Haugen
```

</details>

<details><summary>nedbetaling-3</summary>

```
Hei,

Jeg har mottatt varselet deres datert 21. oktober 2026 om rettslig inndriving.

Jeg bestrider ikke kravet på 12 480,00 kr, men jeg kan ikke betale hele beløpet på én gang. Jeg foreslår å betale 1 000 kr per måned i 13 måneder, med et siste avdrag på 480 kr.

Jeg ber om følgende:
- Bekreft skriftlig om dere godtar nedbetalingsplanen.
- Sett forliksklage og videre inndriving på vent mens forslaget vurderes.
- Ikke legg til nye omkostninger i denne perioden.

Vennlig hilsen
Kristian Vik
```

</details>

<details><summary>nedbetaling-4</summary>

```
Hei,

Jeg har mottatt inkassovarselet fra Bølgen Mobil AS, fakturanummer 2026-005512, datert 22. oktober 2026. Jeg bestrider ikke kravet på 2 150,00 kr.

Jeg kan betale litt hver måned etter lønning, men ikke hele beløpet innen 5. november 2026. Jeg foreslår derfor 300 kr i måneden i åtte måneder, med et siste avdrag på 50 kr.

Bekreft skriftlig om dere godtar nedbetalingsplanen. Sett saken på vent til dere har svart. Ikke legg til flere gebyrer mens forslaget vurderes.

Vennlig hilsen
Hanne Strand
```

</details>

<details><summary>utsettelse-1</summary>

```
Hei,

Jeg har mottatt inkassovarselet deres datert 16. oktober 2026, kundenummer 459902, på 1 535,00 kr med frist 30. oktober. Kravet er riktig.

Jeg får lønn 12. november og kan betale hele beløpet da. Jeg ber derfor om utsatt frist til denne datoen.

Bekreft skriftlig at fristen flyttes til 12. november.

Vennlig hilsen
Martin Eide
```

</details>

<details><summary>utsettelse-2</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen deres datert 23. oktober 2026, saksnummer NI-2026-13999, med frist 6. november. Jeg bestrider ikke kravet på 3 475,00 kr.

Jeg venter på feriepenger og kan betale hele beløpet 20. november 2026. Jeg ber om utsatt frist til denne datoen.

Bekreft skriftlig at fristen flyttes. Ikke legg til nye gebyrer i mellomtiden.

Vennlig hilsen
Eva Lunde
```

</details>

<details><summary>utsettelse-3</summary>

```
Hei,

Jeg har mottatt inkassovarselet deres av 24. oktober 2026, kundenr. GS-80314, på 837,00 kroner. Jeg bestrider ikke kravet.

Jeg er sykmeldt og venter på sykepenger. Jeg kan betale hele beløpet 25. november 2026, og ber om utsatt frist til denne datoen.

Bekreft skriftlig at fristen er satt til 25. november. Ikke legg til flere gebyrer i mellomtiden.

Vennlig hilsen
Anders Holm
```

</details>

<details><summary>pastand-1</summary>

```
Hei,

Jeg har mottatt inkassovarselet deres datert 14. oktober 2026, knyttet til faktura 2026-1244.

Jeg bestrider kravet. Fakturaen på 2 450,00 kr er betalt.

Jeg betalte fakturaen 3. september 2026 og har kvittering fra nettbanken som bekrefter dette. Kravet skulle dermed vært innfridd lenge før varselet ble sendt.

Jeg ber om at dere:
- sjekker innbetalingen av 3. september 2026 opp mot deres systemer
- bekrefter skriftlig at saken avsluttes
- fjerner gebyret på 38,00 kr

Kvitteringen sender jeg gjerne ved behov.

Vennlig hilsen
Camilla Røed
```

</details>

<details><summary>pastand-2</summary>

```
Hei,

Jeg har mottatt betalingsoppfordringen deres datert 17. oktober 2026, saksnummer VK-2026-6702, på 2 299,00 kr.

Jeg bestrider kravet i sin helhet.

Jeg klaget til Turbutikken Nord AS i juli 2026 fordi glidelåsen på jakken var ødelagt. Kravet gjelder etter alt å dømme nettopp denne jakken, og saken kan derfor ikke sendes til inkasso før reklamasjonen er behandlet.

Kravet er omtvistet og kan ikke drives inn ved ordinær inkasso. Jeg ber om at dere:

- registrerer kravet som omtvistet og stanser videre inndriving
- ikke legger til flere gebyrer eller renter
- videresender min reklamasjon til Turbutikken Nord AS for behandling

Jeg bekrefter gjerne klagen min fra juli ved behov.

Vennlig hilsen
Vegard Nilsen
```

</details>

<details><summary>pastand-3</summary>

```
Hei,

Jeg har mottatt inkassovarselet deres datert 18. oktober 2026, fakturanummer 2026-006033, på 935,00 kr fra Bølgen Mobil AS.

Jeg er uenig i kravet og betaler det ikke.

Jeg sa opp abonnementet skriftlig 15. juni 2026 og har e-postbekreftelse på oppsigelsen. Kravet gjelder abonnement for juli til september 2026, altså etter at oppsigelsen ble mottatt. Det er derfor ikke grunnlag for å fakturere meg for denne perioden, og heller ikke for inkassovarselgebyret på 38,00 kr.

Kravet er omtvistet og kan ikke drives inn ved ordinær inkasso. Jeg ber om at dere:
- registrerer kravet som omtvistet og stanser videre inndriving
- bekrefter dette skriftlig
- enten avslutter saken eller sender den til forliksrådet, hvis dere mener kravet står seg

E-postbekreftelsen sender jeg gjerne ved behov.

Vennlig hilsen
Silje Aas
```

</details>
<!-- utkast:slutt -->
