import { evaluate } from "mathjs";

const ALLOWED_CHARS = /^[0-9+\-*/.()\s]*$/;

export function evaluateMathInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed || !ALLOWED_CHARS.test(trimmed)) return null;

  try {
    const result = evaluate(trimmed);
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
