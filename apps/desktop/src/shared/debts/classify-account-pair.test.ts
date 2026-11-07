import { describe, expect, it } from "vitest";
import { classifyAccountPair, UnsupportedAccountPairError } from "./classify-account-pair";

describe("classifyAccountPair — valas", () => {
  it("mengenali beli dan jual valas", () => {
    expect(classifyAccountPair("cash", "forex")).toBe("cash-forex");
    expect(classifyAccountPair("forex", "cash")).toBe("forex-cash");
  });

  it.each([
    ["forex", "forex"],
    ["forex", "debt"],
    ["debt", "forex"],
    ["forex", "investment"],
    ["investment", "forex"],
    ["forex", "third_party"],
    ["third_party", "forex"],
  ] as const)("menolak kombinasi %s -> %s", (source, destination) => {
    expect(() => classifyAccountPair(source, destination)).toThrow(UnsupportedAccountPairError);
  });
});
