import { useState } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Platform, Pressable, Text, View } from "react-native";
// eslint-disable-next-line import/no-named-as-default
import DateTimePicker from "@expo/ui/community/datetime-picker";

type FormFieldDateProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  disabled?: boolean;
};

function parseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const combined = new Date(datePart);
  combined.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return combined;
}

function formatLabel(date: Date): string {
  const dateLabel = date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel}, ${timeLabel}`;
}

export function FormFieldDate<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  disabled,
}: FormFieldDateProps<TFieldValues>) {
  const [step, setStep] = useState<"closed" | "pick-date" | "pick-time" | "pick-datetime">(
    "closed"
  );
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedDate = parseDate(field.value ?? "");

        return (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">{label}</Text>
            <Pressable
              className="rounded-md border border-neutral-300 px-3 py-2 disabled:opacity-50"
              disabled={disabled}
              onPress={() => setStep(Platform.OS === "android" ? "pick-date" : "pick-datetime")}
            >
              <Text className="text-neutral-900">{formatLabel(selectedDate)}</Text>
            </Pressable>

            {Platform.OS === "android" && step === "pick-date" && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                presentation="dialog"
                onValueChange={(_event, date) => {
                  setPendingDate(date);
                  setStep("pick-time");
                }}
                onDismiss={() => setStep("closed")}
              />
            )}

            {Platform.OS === "android" && step === "pick-time" && (
              <DateTimePicker
                value={pendingDate ?? selectedDate}
                mode="time"
                presentation="dialog"
                onValueChange={(_event, time) => {
                  const base = pendingDate ?? selectedDate;
                  field.onChange(combineDateAndTime(base, time).toISOString());
                  setPendingDate(null);
                  setStep("closed");
                }}
                onDismiss={() => {
                  setPendingDate(null);
                  setStep("closed");
                }}
              />
            )}

            {Platform.OS !== "android" && step === "pick-datetime" && (
              <DateTimePicker
                value={selectedDate}
                mode="datetime"
                onValueChange={(_event, date) => {
                  field.onChange(date.toISOString());
                  setStep("closed");
                }}
              />
            )}

            {fieldState.error && (
              <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
            )}
          </View>
        );
      }}
    />
  );
}
