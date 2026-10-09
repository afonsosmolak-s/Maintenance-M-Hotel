import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("keeps internal paths", () => {
    expect(safeNextPath("/e/123/equipe?x=1")).toBe("/e/123/equipe?x=1");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "evil", undefined, 42])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBe("/inicio");
  });
});
