import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Delete } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evaluateMathInput } from "@/lib/math-input";

const OPERATORS = ["+", "-", "*", "/"];
const ALLOWED_INPUT_CHARS = /[^0-9+\-*/.]/g;

const KEYS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["00", "0", ".", "+"],
];

type NumpadCalculatorProps = {
  initialValue: number;
  onSubmit: (value: number) => void;
};

export function NumpadCalculator({
  initialValue,
  onSubmit,
}: NumpadCalculatorProps) {
  const [expression, setExpression] = useState(
    initialValue ? String(initialValue) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setExpression(initialValue ? String(initialValue) : "");
  }, [initialValue]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const preview = evaluateMathInput(expression);
  const endsWithOperator = OPERATORS.includes(expression.slice(-1));
  const canSubmit = expression !== "" && preview !== null;

  function press(key: string) {
    setExpression((prev) => {
      const lastChar = prev.slice(-1);

      if (OPERATORS.includes(key)) {
        if (prev === "" && key !== "-") return prev;
        if (OPERATORS.includes(lastChar)) return prev.slice(0, -1) + key;
        return prev + key;
      }

      if (key === ".") {
        const lastNumber = prev.split(/[+\-*/]/).pop() ?? "";
        if (lastNumber.includes(".")) return prev;
        return prev + (lastNumber === "" ? "0." : ".");
      }

      return prev + key;
    });
  }

  function backspace() {
    setExpression((prev) => prev.slice(0, -1));
  }

  function clear() {
    setExpression("");
  }

  function handleDone() {
    if (!canSubmit) return;
    onSubmit(preview);
  }

  function handleInputChange(raw: string) {
    setExpression(raw.replace(ALLOWED_INPUT_CHARS, ""));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleDone();
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/30 px-3 py-2">
        <Input
          ref={inputRef}
          value={expression}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className="h-auto border-none bg-transparent p-0 text-right text-xs text-muted-foreground shadow-none focus-visible:ring-0"
        />
        <p className="h-7 text-right text-lg font-semibold">
          {preview !== null ? preview.toLocaleString("id-ID") : " "}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.flat().map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-10"
            disabled={OPERATORS.includes(key) && endsWithOperator}
            onClick={() => press(key)}
          >
            {key}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={clear}
        >
          AC
        </Button>
        <Button
          type="button"
          variant="outline"
          className="col-span-2 h-10"
          onClick={backspace}
        >
          <Delete className="size-4" />
        </Button>
        <Button
          type="button"
          className="h-10"
          disabled={!canSubmit}
          onClick={handleDone}
        >
          Selesai
        </Button>
      </div>
    </div>
  );
}
