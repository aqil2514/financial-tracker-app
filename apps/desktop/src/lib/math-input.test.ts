import { describe, expect, it } from "vitest";
import { evaluateMathInput } from "./math-input";

describe("evaluateMathInput", () => {
  it("evaluates a plain number", () => {
    expect(evaluateMathInput("37410")).toBe(37410);
  });

  it("evaluates addition", () => {
    expect(evaluateMathInput("10000+5000")).toBe(15000);
  });

  it("evaluates mixed operators with precedence", () => {
    expect(evaluateMathInput("1000+2*500")).toBe(2000);
  });

  it("evaluates parentheses", () => {
    expect(evaluateMathInput("(1000+500)*2")).toBe(3000);
  });

  it("evaluates division", () => {
    expect(evaluateMathInput("9000/3")).toBe(3000);
  });

  it("returns null for empty input", () => {
    expect(evaluateMathInput("")).toBeNull();
    expect(evaluateMathInput("   ")).toBeNull();
  });

  it("returns null for invalid expression", () => {
    expect(evaluateMathInput("10000+")).toBeNull();
  });

  it("rejects non-numeric-expression characters", () => {
    expect(evaluateMathInput("sqrt(4)")).toBeNull();
    expect(evaluateMathInput("1; alert(1)")).toBeNull();
  });
});
