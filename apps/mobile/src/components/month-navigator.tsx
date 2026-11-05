import { useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OptionPicker, type OptionPickerRef } from "@/components/query/shared/option-picker";
import { currentMonth, shiftMonth } from "@/lib/utils";

const ALL_TIME = "all";
const MONTHS_BACK = 36;
const MONTHS_FORWARD = 3;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;
}

interface MonthNavigatorProps {
  // "YYYY-MM"; null = semua waktu
  month: string | null;
  onChange: (month: string | null) => void;
  // false untuk layar yang butuh satu bulan pasti (mis. Laporan): opsi
  // "Semua waktu" tidak ditawarkan.
  allowAllTime?: boolean;
}

export function MonthNavigator({ month, onChange, allowAllTime = true }: MonthNavigatorProps) {
  const pickerRef = useRef<OptionPickerRef>(null);

  const options = useMemo(() => {
    const current = currentMonth();
    const months = Array.from({ length: MONTHS_BACK + MONTHS_FORWARD + 1 }, (_, i) =>
      shiftMonth(current, MONTHS_FORWARD - i)
    ).map((m) => ({ value: m, label: formatMonth(m) }));
    return allowAllTime ? [{ value: ALL_TIME, label: "Semua waktu" }, ...months] : months;
  }, [allowAllTime]);

  // Saat "Semua waktu", panah tidak punya arah — mulai dari bulan berjalan.
  const base = month ?? currentMonth();

  return (
    <View className="flex-row items-center gap-1">
      <Pressable className="p-1.5" hitSlop={6} onPress={() => onChange(shiftMonth(base, -1))}>
        <Ionicons name="chevron-back" size={20} color="#171717" />
      </Pressable>
      <Pressable className="min-w-24 items-center py-1" onPress={() => pickerRef.current?.present()}>
        <Text className="text-lg font-bold text-neutral-900">
          {month ? formatMonth(month) : "Semua waktu"}
        </Text>
      </Pressable>
      <Pressable className="p-1.5" hitSlop={6} onPress={() => onChange(shiftMonth(base, 1))}>
        <Ionicons name="chevron-forward" size={20} color="#171717" />
      </Pressable>
      <OptionPicker
        ref={pickerRef}
        title="Pilih Bulan"
        options={options}
        value={month ?? ALL_TIME}
        onSelect={(value) => onChange(value === ALL_TIME ? null : value)}
      />
    </View>
  );
}
