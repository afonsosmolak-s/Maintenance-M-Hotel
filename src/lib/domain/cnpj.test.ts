import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj, normalizeCnpj } from "./cnpj";

describe("isValidCnpj", () => {
  it.each(["11.222.333/0001-81", "11222333000181", "45.723.174/0001-10"])("accepts numeric %s", (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
  });

  it("accepts the alphanumeric example published by the Receita Federal", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
  });

  it.each(["11.222.333/0001-82", "11111111111111", "123", "12.ABC.345/01DE-36", ""])("rejects %s", (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });
});

describe("normalizeCnpj / formatCnpj", () => {
  it("normalizes and formats", () => {
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});
