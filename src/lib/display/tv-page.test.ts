import { parse } from "acorn";
import { describe, expect, it } from "vitest";
import { renderTvPage, TV_SCRIPT, TV_STYLE } from "./tv-page";

/**
 * O painel de TV tem de correr em navegadores de Smart TV com vários anos (Chromium antigo).
 * Estes testes impedem que JavaScript ou CSS modernos entrem na página sem ninguém reparar:
 * numa TV, o sintoma é o ecrã ficar parado em "Carregando…".
 */
describe("TV page compatibility", () => {
  const script = TV_SCRIPT.replace("__PRODUCT__", JSON.stringify("Produto"));

  it("is valid ES5 (no arrow functions, let/const, template strings, optional chaining…)", () => {
    expect(() => parse(script, { ecmaVersion: 5 })).not.toThrow();
  });

  it("does not rely on APIs missing from old TV browsers", () => {
    for (const modern of ["fetch(", "Promise", "async ", "await ", ".padStart(", ".includes(", "Object.assign", "Intl."]) {
      expect(script, `uses ${modern}`).not.toContain(modern);
    }
  });

  it("uses only widely supported CSS", () => {
    for (const modern of ["var(--", "clamp(", "display:grid", "gap:", "inset:", "aspect-ratio"]) {
      expect(TV_STYLE, `uses ${modern}`).not.toContain(modern);
    }
  });

  it("escapes the product name and embeds no credentials", () => {
    const html = renderTvPage('A "marca" </script><script>alert(1)</script>');
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).not.toMatch(/sb_secret_|service_role/);
  });
});
