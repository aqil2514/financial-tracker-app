import { Pressable, Text, View } from "react-native";
import type { DateData } from "react-native-calendars";
import { formatCurrencyShort } from "@/lib/utils";
import type { DaySummary } from "./use-month-summary";

interface CalendarDayProps {
  date?: DateData;
  state?: "selected" | "disabled" | "inactive" | "today" | "";
  onPress?: (date?: DateData) => void;
  summary?: DaySummary;
  isSelected?: boolean;
}

export function CalendarDay({ date, summary, state, onPress, isSelected }: CalendarDayProps) {
  if (!date) return <View style={{ width: 44 }} />;

  const isToday = state === "today";
  const isOtherMonth = state === "disabled";
  const hasActivity = summary && (summary.income > 0 || summary.expense > 0);

  return (
    <Pressable
      style={{
        width: 44,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: "center",
        backgroundColor: isSelected ? "#171717" : isToday ? "#f5f5f5" : "transparent",
      }}
      onPress={() => onPress?.(date)}
    >
      <Text
        style={{
          fontSize: 14,
          color: isSelected ? "#ffffff" : isOtherMonth ? "#d4d4d4" : "#171717",
        }}
      >
        {date.day}
      </Text>
      {hasActivity ? (
        <View style={{ alignItems: "center" }}>
          {summary.income > 0 && (
            <Text
              style={{
                fontSize: 9,
                lineHeight: 11,
                color: isSelected ? "#6ee7b7" : "#059669",
              }}
              numberOfLines={1}
            >
              +{formatCurrencyShort(summary.income)}
            </Text>
          )}
          {summary.expense > 0 && (
            <Text
              style={{
                fontSize: 9,
                lineHeight: 11,
                color: isSelected ? "#fca5a5" : "#dc2626",
              }}
              numberOfLines={1}
            >
              -{formatCurrencyShort(summary.expense)}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ height: 22 }} />
      )}
    </Pressable>
  );
}
