import { describe, expect, it } from "vitest";
import { buildLocationTree, descendantIds, flattenTree, locationPaths, type FlatLocation } from "./locations";

const loc = (id: string, parentId: string | null, name: string, sortOrder = 0): FlatLocation => ({
  id,
  parentId,
  name,
  sortOrder,
  active: true,
});

const sample = [
  loc("b", null, "Bloco B"),
  loc("a", null, "Bloco A"),
  loc("s10", "a", "Suíte 10"),
  loc("s2", "a", "Suíte 2"),
  loc("ban", "s2", "Banheiro"),
];

describe("buildLocationTree / flattenTree", () => {
  it("orders siblings naturally and sets depth", () => {
    const flat = flattenTree(buildLocationTree(sample));
    expect(flat.map((n) => `${n.depth}:${n.name}`)).toEqual([
      "0:Bloco A",
      "1:Suíte 2",
      "2:Banheiro",
      "1:Suíte 10",
      "0:Bloco B",
    ]);
  });

  it("treats a location whose parent is missing as a root", () => {
    const roots = buildLocationTree([loc("x", "missing", "Órfão")]);
    expect(roots.map((r) => r.name)).toEqual(["Órfão"]);
  });
});

describe("locationPaths", () => {
  it("builds breadcrumb paths", () => {
    const paths = locationPaths(sample);
    expect(paths.get("ban")).toBe("Bloco A › Suíte 2 › Banheiro");
    expect(paths.get("b")).toBe("Bloco B");
  });
});

describe("descendantIds", () => {
  it("includes the location and every level below it", () => {
    expect([...descendantIds(sample, "a")].sort()).toEqual(["a", "ban", "s10", "s2"]);
    expect([...descendantIds(sample, "ban")]).toEqual(["ban"]);
  });
});
