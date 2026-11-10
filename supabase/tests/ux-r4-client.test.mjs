import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks, cache = new Map()) { file = resolve(file); if (cache.has(file))
    return cache.get(file); const out = {}; cache.set(file, out); const js = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022
    }
}).outputText; new Function("require", "exports", js)(name => { if (Object.hasOwn(mocks, name))
    return mocks[name]; let path = name.startsWith("@/") ? resolve("src", name.slice(2)) : name.startsWith(".") ? resolve(dirname(file), name) : null; if (!path)
    return require(name); if (!existsSync(path))
    path += existsSync(path + ".ts") ? ".ts" : ".tsx"; return load(path, mocks, cache); }, out); return out; }
function nodes(n) { if (!n)
    return []; if (Array.isArray(n))
    return n.flatMap(nodes); if (typeof n !== "object" || !n.props)
    return []; return [n, ...["children", "opplysninger", "kontroll", "handling"].flatMap(k => nodes(n.props[k]))]; }
const result = {
    ok: true,
    original_tekst: "Syntetisk inkassovarsel.",
    kravForslag: null,
    alvorlig: false,
    analyse: {
        avsender: "Test",
        avsender_epost: "test@example.invalid",
        brevtype: "inkassovarsel",
        brevdato: "2026-11-08",
        belop: "1288,50",
        hovedstol: "1250,50",
        saksnummer: "R4-TEST",
        svar_utfall: "uklart",
        foreslatte_frister: [],
        foreslatte_steg: ["Sjekk originalen"],
        kostnadslinjer: [{
                type: "purregebyr",
                belop: 38,
                tekst: "Purregebyr"
            }]
    }
};
function harness({ save = async () => ({
    ok: true,
    sakId: "sak-r4",
    brevId: "brev-r4"
}), navigate = () => { }, existing = false, caseStatus = "aktiv" } = {}) { let i = 0; const values = [], calls = [], urls = []; const mocks = {
    react: {
        useState: init => { const n = i++; if (!(n in values))
            values[n] = typeof init === "function" ? init() : init; return [values[n], v => values[n] = typeof v === "function" ? v(values[n]) : v]; },
        useRef: init => { const n = i++; return values[n] ?? (values[n] = {
            current: init
        }); },
        useMemo: fn => fn()
    },
    "next/navigation": {
        useRouter: () => ({
            push: url => { urls.push(url); navigate(url); },
            refresh() { throw Error("Unexpected refresh"); },
            back() { }
        })
    },
    "motion/react": {
        m: new Proxy({}, {
            get: (_, p) => p
        }),
        AnimatePresence: "presence"
    },
    "@/lib/haptikk": {
        haptikk() { }
    },
    "@/components/ui": {
        "Prim\u00E6rknapp": "primary"
    },
    "@/components/ui/Avkrysning": {
        Avkrysning: "check"
    },
    "@/components/Bevegelsesramme": {
        Bevegelsesramme: "frame"
    },
    "@/components/Gebyrsjekk": {
        Gebyrsjekk: "fees"
    },
    "@/components/KontrollOmfang": {
        KontrollOmfang: "scope"
    },
    "@/components/Veivalg": {
        Veivalg: "choices"
    },
    "./actions": {
        analyserBrevTekst: async () => structuredClone(result),
        lagreBrev: async (input) => { calls.push(structuredClone(input)); return save(input); }
    },
    "./klargjorFil": {
        klargjorFil() { throw Error("Not used"); }
    }
}; for (const name of ["LeserBrev", "Bekreftelse", "BrevGjennomgang", "KontrollOversikt", "BrevReferanse", "SakOgFrister", "LagretBrev"])
    mocks["./" + name] = {
        [name]: name
    }; const { LeggTilBrevFlyt } = load("src/app/legg-til-brev/LeggTilBrevFlyt.tsx", mocks); const props = {
    krav: existing ? [{
            id: "existing",
            navn: "Eksisterende",
            venter: caseStatus === "venter_pa_svar",
            status: caseStatus,
            sistEndret: "2026-11-09T10:00:00Z",
            brevdatoer: ["2026-11-07"],
            frister: []
        }] : [],
    forvalgtKrav: existing ? "existing" : null
}; const h = {
    calls,
    urls,
    render() { i = 0; return LeggTilBrevFlyt(props); },
    node(type) { const n = nodes(h.render()).find(x => x.type === type); assert.ok(n, `missing ${type}`); return n; },
    async ready() { nodes(h.render()).find(n => n.props.tittel === "Lim inn tekst").props.onClick(); h.node("textarea").props.onChange({
        target: {
            value: "Syntetisk testbrev R4"
        }
    }); await h.node("primary").props.onClick(); h.node("Bekreftelse").props.onBekreftet(true); }
}; return h; }
for (const [name, target] of [["svarM\u00E5l", "/utkast?type=innsigelse&brev=brev-r4&lagret=brev-r4"], ["betaleM\u00E5l", "/veier-ut?brev=brev-r4&lagret=brev-r4"], ["senereM\u00E5l", "?lagret=brev-r4"]])
    test(`R4: ${name} lagrer riktige data én gang og navigerer etter svar`, async () => { const h = harness({
        existing: true
    }); await h.ready(); await h.node("choices").props[name].onKlikk(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].krav.sakId, "existing"); assert.equal(h.calls[0].belop, 1288.5); assert.equal(h.calls[0].bekreftet, true); assert.equal(h.calls[0].foreslatte_steg.length, 1); assert.equal(h.calls[0].valgteFrister.length, 1); assert.deepEqual(h.urls, ["/krav/sak-r4" + target]); assert.equal(h.node("LagretBrev").props.brevId, "brev-r4"); assert.ok(!("sendt_at" in h.calls[0])); });
test("R4: synkron l\u00E5s blokkerer dobbelttrykk f\u00F8r ny rendering", async () => { let done; const h = harness({
    save: () => new Promise(r => done = r)
}); await h.ready(); const action = h.node("choices").props.senereMål.onKlikk; const first = action(); await action(); assert.equal(h.calls.length, 1); assert.deepEqual(h.urls, []); done({
    ok: true,
    sakId: "sak-r4",
    brevId: "brev-r4"
}); await first; assert.equal(h.calls.length, 1); });
for (const mode of ["server", "network", "timeout"])
    test(`R4: ${mode} bevarer verdier og samme idempotensnøkkel ved retry`, async () => { let count = 0; const h = harness({
        save: async () => { if (count++ === 0) {
            if (mode === "server")
                return {
                    ok: false,
                    feil: "Serveren avviste"
                };
            throw Error(mode);
        } return {
            ok: true,
            sakId: "sak-r4",
            brevId: "brev-r4"
        }; }
    }); await h.ready(); await h.node("choices").props.senereMål.onKlikk(); assert.deepEqual(h.urls, []); assert.equal(h.node("Bekreftelse").props.belop, "1288,50"); assert.ok(h.node("BrevGjennomgang").props.feil); assert.equal(h.node("choices").props.lagringUkjent, mode !== "server"); await h.node("choices").props.senereMål.onKlikk(); assert.equal(h.calls[0].lagringsnokkel, h.calls[1].lagringsnokkel); assert.equal(h.calls[1].krav.modus, "ny"); });
test("R4: navigasjonsfeil etter lagring viser lagret tilstand uten ny lagring", async () => { const h = harness({
    navigate: () => { throw Error("syntetisk navigasjonsfeil"); }
}); await h.ready(); const fn = h.node("choices").props.senereMål.onKlikk; await fn(); assert.equal(h.node("LagretBrev").props.navigasjonsfeil, true); await fn(); assert.equal(h.calls.length, 1); });
test("R4: ugyldiggjort bekreftelse skjuler handlingene og blokkerer videref\u00F8ring", async () => { const h = harness(); await h.ready(); h.node("Bekreftelse").props.onBelop("289"); assert.equal(h.node("BrevGjennomgang").props.bekreftet, false); assert.ok(!nodes(h.render()).some(n => n.type === "choices")); assert.equal(h.calls.length, 0); });
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const uiMocks = {
    "@/components/NavLenke": {
        NavLenke: "a"
    },
    "motion/react": {
        AnimatePresence: ({ children }) => children,
        m: {
            div: "div"
        }
    },
    "@/lib/haptikk": {
        haptikk() { }
    }
};
test("R4: tre likeverdige knapper forklarer lagring og sending", () => { const { Veivalg } = load("src/components/Veivalg.tsx", uiMocks); const maal = {
    type: "klikk",
    onKlikk() { },
    deaktivert: true
}; const html = renderToStaticMarkup(createElement(Veivalg, {
    harGebyrfunn: false,
    svarMål: maal,
    betaleMål: maal,
    senereMål: maal,
    lagreForst: true,
    lagrer: true
})); for (const label of ["Svar p\u00E5 kravet", "Finn en betalingsl\u00F8sning", "Bestem senere", "Ingenting sendes automatisk", "Venter p\u00E5 bekreftelse av lagringen"])
    assert.ok(html.includes(label), label); assert.equal((html.match(/disabled=""/g) || []).length, 3); assert.ok(html.includes("aria-busy=\"true\"")); });
test("R4: kort og alvorlig varsel st\u00E5r utenfor lukket sak/frister", () => { const { SakOgFrister } = load("src/app/legg-til-brev/SakOgFrister.tsx", {}); const { kontrollerBrevfunn } = load("src/lib/brevkontroll.ts", {}); const f = kontrollerBrevfunn({
    brevtype: "inkassovarsel",
    brevdato: "2026-11-08",
    original_tekst: "Test",
    fristIBrevet: {
        tittel: "Frist",
        forfallsdato: "2026-11-15"
    }
}); const html = renderToStaticMarkup(createElement(SakOgFrister, {
    sakNavn: "Ny sak",
    frister: [],
    fristfunn: f.fristfunn,
    alvorlig: true,
    harMatch: false,
    kreverBekreftelse: true
}, "INNSTILLINGER")); const utenfor = html.split("<details")[0]; assert.ok(utenfor.includes("Fristen i brevet kan v\u00E6re for kort")); assert.ok(utenfor.includes("alvorlig varsel")); assert.ok(html.includes("Ingen frister valgt for lagring")); assert.ok(!html.includes("Neste valgte frist")); assert.ok(html.includes("s\u00E6rskilte valg og bekreftelser")); });
test("R4: bare valgte frister oppsummeres, ogs\u00E5 historiske datoer", () => { const { SakOgFrister } = load("src/app/legg-til-brev/SakOgFrister.tsx", {}); const html = renderToStaticMarkup(createElement(SakOgFrister, {
    sakNavn: "Eksisterende sak",
    frister: [{
            tittel: "Valgt",
            forfallsdato: "2026-07-27",
            kilde: "brev_eksplisitt"
        }],
    fristfunn: null,
    alvorlig: false,
    harMatch: false,
    kreverBekreftelse: false
}, null)); assert.ok(html.includes("Eksisterende sak")); assert.ok(html.includes("1 valgt frist")); assert.ok(html.includes("27. juli") || html.includes("27. jul.")); assert.ok(!html.includes("open=\"\"")); });
for (const [brevParam, expected] of [["eldre-brev", "eldre-brev"], [undefined, "nyere-brev"], ["annen-sak", "NOT_FOUND"]])
    test(`R4: betalingssiden bruker autorisert brevparameter ${brevParam}`, async () => { const filtre = []; const rows = [{
            id: "nyere-brev"
        }, {
            id: "eldre-brev"
        }]; const db = {
        auth: {
            getUser: async () => ({
                data: {
                    user: {
                        id: "bruker"
                    }
                }
            })
        },
        from(table) { const q = {
            select() { return q; },
            eq(k, v) { filtre.push([table, k, v]); return q; },
            order() { return q; },
            limit() { return Promise.resolve({
                data: rows.filter(r => !filtre.some(f => f[0] === "brev" && f[1] === "id") || r.id === brevParam),
                error: null
            }); },
            maybeSingle() { return Promise.resolve({
                data: {
                    id: "sak",
                    tittel: "Test",
                    kreditor: "Test",
                    belop_totalt: 1288.5,
                    sist_endret: "2026-11-09"
                },
                error: null
            }); }
        }; return q; }
    }; const { default: Page } = load("src/app/(app)/krav/[id]/veier-ut/page.tsx", {
        "@/lib/supabase/server": {
            createClient: async () => db
        },
        "next/navigation": {
            notFound() { throw Error("NOT_FOUND"); },
            redirect() { throw Error("LOGIN"); }
        },
        "@/components/ui": {
            Skjermramme: "frame",
            Sekvens: "section",
            SekvensDel: "div"
        },
        "@/components/NavLenke": {
            NavLenke: "a"
        },
        "./VeierUtFlyt": {
            VeierUtFlyt: "pay"
        },
        "@/components/LagretBrevMerknad": {
            LagretBrevMerknad: "receipt"
        }
    }); const args = {
        params: Promise.resolve({
            id: "sak"
        }),
        searchParams: Promise.resolve({
            brev: brevParam
        })
    }; if (expected === "NOT_FOUND") {
        await assert.rejects(Page(args), /NOT_FOUND/);
        return;
    } const tree = await Page(args); const pay = nodes(tree).find(n => n.type === "pay"); assert.equal(pay.props.brevId, expected); assert.equal(pay.props.total, 1288.5); const eyebrow = nodes(tree).find(n => n.type === "p" && n.props.className === "eyebrow mb-1").props.children; assert.match(eyebrow, /1\D288,5 kr/); assert.ok(filtre.some(f => f[0] === "brev" && f[1] === "sak_id" && f[2] === "sak")); assert.ok(filtre.some(f => f[0] === "brev" && f[1] === "bruker_id" && f[2] === "bruker")); });
test("R4: ukjent lagringsresultat omtales aldri som sikkert ulagret", () => {
    const { Veivalg } = load("src/components/Veivalg.tsx", uiMocks);
    const maal = {
        type: "klikk",
        onKlikk() { }
    };
    const html = renderToStaticMarkup(createElement(Veivalg, {
        harGebyrfunn: false,
        svarMål: maal,
        betaleMål: maal,
        senereMål: maal,
        lagreForst: true,
        lagringUkjent: true
    }));
    assert.ok(html.includes("Lagringsresultatet er ukjent"));
    assert.ok(!html.includes("Brevet er ikke lagret enn\u00E5"));
});
function visibleText(n) { if (typeof n === "string")
    return n; if (Array.isArray(n))
    return n.map(visibleText).join(""); return visibleText(n?.props?.children ?? ""); }
for (const reopen of [false, true])
    test(`R4: gjenåpning beholdes som eksplisitt valg (${reopen})`, async () => {
        const h = harness({
            existing: true,
            caseStatus: "fullfort"
        });
        await h.ready();
        const label = nodes(h.render()).find(n => n.type === "label" && visibleText(n).includes("\u00C5pne saken igjen."));
        assert.ok(label);
        assert.ok(!nodes(h.node("SakOgFrister").props.children).includes(label));
        if (reopen)
            nodes(label).find(n => n.type === "check").props.onChange(true);
        await h.node("choices").props.senereMål.onKlikk();
        assert.equal(h.calls[0].gjenapne, reopen);
    });
test("R4: avslutning i ventende sak krever synlig s\u00E6rskilt bekreftelse", async () => {
    const h = harness({
        existing: true,
        caseStatus: "venter_pa_svar"
    });
    await h.ready();
    const medhold = nodes(h.render()).find(n => n.type === "label" && visibleText(n).trim().startsWith("Medhold"));
    assert.ok(medhold);
    nodes(medhold).find(n => n.type === "input").props.onChange();
    assert.equal(h.node("choices").props.senereMål.deaktivert, true);
    await h.node("choices").props.senereMål.onKlikk();
    assert.equal(h.calls.length, 0);
    const confirm = nodes(h.render()).find(n => n.type === "label" && visibleText(n).includes("Ja, avslutt saken."));
    assert.ok(confirm);
    assert.ok(!nodes(h.node("SakOgFrister").props.children).includes(confirm));
    nodes(confirm).find(n => n.type === "check").props.onChange(true);
    await h.node("choices").props.senereMål.onKlikk();
    assert.equal(h.calls[0].avslutningBekreftet, true);
    assert.equal(h.calls[0].utfall, "medhold");
});

test('R4: uavklart lagring låser rettelser og valg frem til idempotent retry', async () => {
 let tries=0; const h=harness({save:async()=>{if(tries++===0)throw Error('tapt svar');return {ok:true,sakId:'sak-r4',brevId:'brev-r4'};}});await h.ready();await h.node('choices').props.senereMål.onKlikk();
 assert.equal(h.node('BrevGjennomgang').props.opplysningerLast,true);
 const settings=nodes(h.render()).find(n=>n.type==='fieldset'&&n.props['aria-label']==='Valg som skal lagres med brevet');assert.equal(settings.props.disabled,true);
 h.node('Bekreftelse').props.onBelop('289');assert.equal(h.node('Bekreftelse').props.belop,'1288,50');
 await h.node('choices').props.senereMål.onKlikk();assert.deepEqual(h.calls[0],h.calls[1]);assert.equal(h.node('LagretBrev').props.brevId,'brev-r4');
});
