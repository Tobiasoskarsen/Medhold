import { test } from "node:test";
import assert from "node:assert/strict";

import { internRedirect } from "./redirect.ts";

test("interne stier beholdes, med query og hash", () => {
  assert.equal(internRedirect("/"), "/");
  assert.equal(internRedirect("/krav/123"), "/krav/123");
  assert.equal(internRedirect("/krav?fane=brev#topp"), "/krav?fane=brev#topp");
  assert.equal(internRedirect("/sok?url=https://annet.no"), "/sok?url=https://annet.no");
});

test("manglende mål gir fallback", () => {
  assert.equal(internRedirect(null), "/");
  assert.equal(internRedirect(undefined), "/");
  assert.equal(internRedirect(""), "/");
  assert.equal(internRedirect(null, "/hjem"), "/hjem");
});

test("eksterne mål avvises", () => {
  for (const m of [
    "https://evil.com",
    "http://evil.com/",
    "evil.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "//evil.com",
    "///evil.com",
    "////evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "\\/evil.com",
    "/\\/evil.com",
  ]) {
    assert.equal(internRedirect(m), "/", m);
  }
});

test("kontrolltegn avvises (nettlesere fjerner dem før tolking)", () => {
  for (const m of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\u0000/evil.com", "/krav\n"]) {
    assert.equal(internRedirect(m), "/", JSON.stringify(m));
  }
});

test("stier som normaliseres til et annet domene avvises", () => {
  for (const m of ["/.//evil.com", "/..//evil.com", "/a/..//evil.com", "/././/evil.com"]) {
    assert.equal(internRedirect(m), "/", m);
  }
});

test("resultatet peker alltid til samme domene", () => {
  const app = "https://medhold.example/auth/callback";
  for (const m of [
    "/krav/1",
    "/.//evil.com",
    "/..//evil.com",
    "//evil.com",
    "/\\evil.com",
    "/%2f%2fevil.com",
    "/%5cevil.com",
    "/@evil.com",
    "/krav/../../x",
  ]) {
    assert.equal(new URL(internRedirect(m), app).origin, "https://medhold.example", m);
  }
});
