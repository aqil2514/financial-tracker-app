import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { evaluateMathInput } from "@/lib/utils";

const OPERATORS = ["+", "-", "*", "/"];

const KEYS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["00", "0", ".", "+"],
];

type NumpadCalculatorProps = {
  initialValue: string;
  onSubmit: (value: number) => void;
};

export function NumpadCalculator({ initialValue, onSubmit }: NumpadCalculatorProps) {
  const [expression, setExpression] = useState(initialValue);

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

  return (
    <View className="gap-2">
      <View className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
        <Text className="text-right text-xs text-neutral-500" numberOfLines={1}>
          {expression || " "}
        </Text>
        <Text className="text-right text-lg font-semibold text-neutral-900">
          {preview !== null ? preview.toLocaleString("id-ID") : " "}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {KEYS.flat().map((key) => (
          <Pressable
            key={key}
            disabled={OPERATORS.includes(key) && endsWithOperator}
            className="h-12 w-[23%] items-center justify-center rounded-md border border-neutral-300 disabled:opacity-40"
            onPress={() => press(key)}
          >
            <Text className="text-lg text-neutral-900">{key}</Text>
          </Pressable>
        ))}

        <Pressable
          className="h-12 w-[23%] items-center justify-center rounded-md border border-neutral-300"
          onPress={clear}
        >
          <Text className="font-medium text-neutral-900">AC</Text>
        </Pressable>
        <Pressable
          className="h-12 w-[48.5%] items-center justify-center rounded-md border border-neutral-300"
          onPress={backspace}
        >
          <Text className="text-lg text-neutral-900">⌫</Text>
        </Pressable>
        <Pressable
          disabled={!canSubmit}
          className="h-12 w-[23%] items-center justify-center rounded-md bg-neutral-900 disabled:opacity-40"
          onPress={handleDone}
        >
          <Text className="font-medium text-white">OK</Text>
        </Pressable>
      </View>
    </View>
  );
}
