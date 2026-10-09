import { describe, expect, it } from "vitest";
import { PERMISSION_GROUPS, PERMISSIONS } from "./permissions";

describe("PERMISSION_GROUPS", () => {
  it("lists every permission exactly once", () => {
    const listed = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.key));
    expect([...listed].sort()).toEqual([...PERMISSIONS].sort());
  });
});
