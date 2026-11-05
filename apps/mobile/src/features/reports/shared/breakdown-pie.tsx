import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { formatCurrency } from "@/lib/utils";
import { breakdownRowKey, type BreakdownChartRow } from "./breakdown-chart-data";
import { computeSlices, describeSector, polar } from "./donut-geometry";

// Layar - padding halaman (p-4 x2) - padding kartu (p-3 x2).
const CHART_WIDTH = Dimensions.get("window").width - 32 - 24;
const CHART_HEIGHT = 180;
// Proporsi radius sama dengan desktop (Recharts: inner 55%, outer 90%).
const MAX_RADIUS = CHART_HEIGHT / 2;
const OUTER_RADIUS = MAX_RADIUS * 0.9;
const INNER_RADIUS = MAX_RADIUS * 0.55;
const ANIMATION_MS = 900;
// Seberapa jauh irisan terpilih menonjol keluar.
const POP_OUT = 8;
const TOOLTIP_WIDTH = 150;
const TOOLTIP_HEIGHT = 64;
const TOOLTIP_MS = 180;

interface BreakdownPieProps {
  rows: BreakdownChartRow[];
  // Kunci baris (breakdownRowKey) yang sedang dipilih; null = tidak ada.
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Donut digambar sendiri (bukan react-native-chart-kit) supaya bisa dianimasikan
// terbuka melingkar seperti Recharts di desktop. Semua animasi di sini memakai
// Animated bawaan RN; props SVG tidak mendukung native driver, jadi progress
// donut dan gerak menonjol irisan di-render ulang per frame lewat listener.
// Nilai negatif (mis. saldo utang) tidak bisa digambar, jadi hanya baris bertotal
// positif yang masuk; angka tiap baris tetap ditampilkan penuh di daftar pemanggil.
export function BreakdownPie({ rows, selectedKey, onSelect }: BreakdownPieProps) {
  const positive = rows.filter((row) => row.total > 0);
  const [progress, setProgress] = useState(0);
  // Seberapa jauh tiap irisan sudah menonjol (0..1, bisa sedikit >1 karena pegas).
  const [popAmounts, setPopAmounts] = useState<Record<string, number>>({});
  const popValues = useRef<Record<string, Animated.Value>>({});
  const [tooltipKey, setTooltipKey] = useState<string | null>(null);
  const [tooltipAnim] = useState(() => new Animated.Value(0));

  // Tooltip tetap memegang kunci terakhir supaya bisa memudar keluar saat pilihan dibatalkan.
  if (selectedKey && selectedKey !== tooltipKey) setTooltipKey(selectedKey);

  useEffect(() => {
    const value = new Animated.Value(0);
    const id = value.addListener(({ value: next }) => setProgress(next));
    Animated.timing(value, {
      toValue: 1,
      duration: ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => value.removeListener(id);
  }, []);

  // Irisan yang dipilih menonjol dengan pegas, yang sebelumnya kembali masuk.
  useEffect(() => {
    const values = popValues.current;
    const keys = new Set(Object.keys(values));
    if (selectedKey) keys.add(selectedKey);

    const running: Animated.CompositeAnimation[] = [];
    keys.forEach((key) => {
      let value = values[key];
      if (!value) {
        value = new Animated.Value(0);
        value.addListener(({ value: next }) => setPopAmounts((prev) => ({ ...prev, [key]: next })));
        values[key] = value;
      }
      const animation = Animated.spring(value, {
        toValue: key === selectedKey ? 1 : 0,
        friction: 6,
        tension: 140,
        useNativeDriver: false,
      });
      animation.start();
      running.push(animation);
    });

    return () => running.forEach((animation) => animation.stop());
  }, [selectedKey]);

  useEffect(() => {
    const values = popValues.current;
    return () => Object.values(values).forEach((value) => value.removeAllListeners());
  }, []);

  useEffect(() => {
    if (selectedKey) tooltipAnim.setValue(0);
    const animation = Animated.timing(tooltipAnim, {
      toValue: selectedKey ? 1 : 0,
      duration: TOOLTIP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selectedKey, tooltipAnim]);

  if (positive.length === 0) return null;

  const slices = computeSlices(
    positive.map((row) => row.total),
    progress
  );
  const cx = CHART_WIDTH / 2;
  const cy = CHART_HEIGHT / 2;

  const tooltipIndex = positive.findIndex((row) => breakdownRowKey(row) === tooltipKey);
  const tooltipRow = tooltipIndex >= 0 ? positive[tooltipIndex] : null;
  const tooltipSlice = tooltipIndex >= 0 ? slices[tooltipIndex] : null;

  // Tooltip diletakkan di sekitar tengah irisan, dijepit agar tidak keluar chart.
  let tooltipPosition: { left: number; top: number } | null = null;
  if (tooltipSlice) {
    const mid = (tooltipSlice.startAngle + tooltipSlice.endAngle) / 2;
    const anchor = polar(cx, cy, (INNER_RADIUS + OUTER_RADIUS) / 2 + POP_OUT, mid);
    tooltipPosition = {
      left: clamp(anchor.x - TOOLTIP_WIDTH / 2, 0, CHART_WIDTH - TOOLTIP_WIDTH),
      top: clamp(anchor.y - TOOLTIP_HEIGHT / 2, 0, CHART_HEIGHT - TOOLTIP_HEIGHT),
    };
  }

  return (
    <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT }}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Rect width={CHART_WIDTH} height={CHART_HEIGHT} fill="transparent" onPress={() => onSelect(null)} />
        {slices.map((slice, index) => {
          const row = positive[index];
          const key = breakdownRowKey(row);
          const isSelected = key === selectedKey;

          const mid = (slice.startAngle + slice.endAngle) / 2;
          const offset = polar(0, 0, POP_OUT * (popAmounts[key] ?? 0), mid);

          return describeSector(
            cx + offset.x,
            cy + offset.y,
            INNER_RADIUS,
            OUTER_RADIUS,
            slice.startAngle,
            slice.endAngle
          ).map((d, part) => (
            <Path
              key={`${key}-${part}`}
              d={d}
              fill={row.color}
              onPress={() => onSelect(isSelected ? null : key)}
            />
          ));
        })}
      </Svg>

      {tooltipRow && tooltipPosition && (
        <Animated.View
          pointerEvents="none"
          className="absolute items-center justify-center rounded-md border border-neutral-200 bg-white px-2 py-1 shadow"
          style={{
            ...tooltipPosition,
            width: TOOLTIP_WIDTH,
            height: TOOLTIP_HEIGHT,
            opacity: tooltipAnim,
            transform: [
              { translateY: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
              { scale: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          }}
        >
          <Text className="text-xs text-neutral-500" numberOfLines={1}>
            {tooltipRow.label}
          </Text>
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {formatCurrency(tooltipRow.total)}
          </Text>
          <Text className="text-xs text-neutral-500">{tooltipRow.percent.toFixed(1)}%</Text>
        </Animated.View>
      )}
    </View>
  );
}
