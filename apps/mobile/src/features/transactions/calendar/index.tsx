import { useState } from "react";
import { View } from "react-native";
import { Calendar, type DateData } from "react-native-calendars";
import { CalendarDay } from "./calendar-day";
import { useMonthSummary } from "./use-month-summary";

interface TransactionCalendarProps {
  month: string;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
}

export function TransactionCalendar({ month, onMonthChange, onSelectDate }: TransactionCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const monthSummary = useMonthSummary(month);

  function handleDayPress(date: DateData) {
    setSelectedDate(date.dateString);
    onSelectDate(date.dateString);
  }

  return (
    <View className="px-2">
      <Calendar
        current={`${month}-01`}
        onMonthChange={(date) => {
          const next = date.dateString.slice(0, 7);
          if (next !== month) onMonthChange(next);
        }}
        onDayPress={handleDayPress}
        hideExtraDays={false}
        dayComponent={({ date, state }) => (
          <CalendarDay
            date={date}
            state={state as "selected" | "disabled" | "inactive" | "today" | ""}
            onPress={() => date && handleDayPress(date)}
            summary={date ? monthSummary[date.dateString] : undefined}
            isSelected={date?.dateString === selectedDate}
          />
        )}
      />
    </View>
  );
}
