import { describe, expect, it } from "vitest";
import { classifyAccountPair, UnsupportedAccountPairError } from "./classify-account-pair";

describe("classifyAccountPair", () => {
  it.each([
    ["cash", "cash", "cash-cash"],
    ["cash", "debt", "cash-debt"],
    ["debt", "cash", "debt-cash"],
    ["debt", "debt", "debt-debt"],
    ["cash", "investment", "cash-investment"],
    ["investment", "cash", "investment-cash"],
  ])("%s -> %s = %s", (source, destination, expected) => {
    expect(classifyAccountPair(source, destination)).toBe(expected);
  });

  it.each([
    ["investment", "debt"],
    ["debt", "investment"],
    ["investment", "investment"],
    ["cash", "third_party"],
  ])("%s -> %s belum didukung", (source, destination) => {
    expect(() => classifyAccountPair(source, destination)).toThrow(UnsupportedAccountPairError);
  });
});
