import { useState } from "react";
import { View } from "react-native";
import { Calendar, type DateData } from "react-native-calendars";
import { CalendarDay } from "./calendar-day";
import { useMonthSummary } from "./use-month-summary";

interface TransactionCalendarProps {
  onSelectDate: (date: string) => void;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function TransactionCalendar({ onSelectDate }: TransactionCalendarProps) {
  const [month, setMonth] = useState(currentMonth);
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
        onMonthChange={(date) => setMonth(date.dateString.slice(0, 7))}
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
