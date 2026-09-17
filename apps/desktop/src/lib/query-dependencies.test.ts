import { describe, expect, it } from "vitest";
import { QUERY_DEPENDENCIES, dependentKeysOf } from "./query-dependencies";

describe("dependentKeysOf", () => {
  it("returns the dependency list for a single domain", () => {
    expect(dependentKeysOf("accountGroups")).toEqual(
      QUERY_DEPENDENCIES.accountGroups
    );
  });

  it("merges multiple domains without duplicating shared keys", () => {
    const result = dependentKeysOf("transactions", "accounts");

    const serialized = result.map((key) => JSON.stringify(key));
    const uniqueSerialized = new Set(serialized);
    expect(serialized.length).toBe(uniqueSerialized.size);

    // accountsQueryKey muncul di kedua domain, tapi harus cuma sekali di hasil akhir.
    expect(
      result.filter(
        (key) => JSON.stringify(key) === JSON.stringify(QUERY_DEPENDENCIES.accounts[0])
      )
    ).toHaveLength(1);
  });

  it("preserves all keys when domains do not overlap", () => {
    const result = dependentKeysOf("accountGroups", "categories");
    expect(result).toEqual([
      ...QUERY_DEPENDENCIES.accountGroups,
      ...QUERY_DEPENDENCIES.categories,
    ]);
  });
});
