import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { formatCurrency, formatCurrencyShort } from "@/lib/utils";
import { MONTH_NAMES_SHORT } from "@/lib/utils/month";
import { bandIndex, computeYTicks } from "@/features/reports/shared/line-chart-geometry";
import { ChartTooltip } from "@/features/reports/shared/chart-tooltip";
import type { MonthlySummaryRow } from "./monthly-summary-rows";

const HEIGHT = 200;
const PAD = { left: 48, right: 12, top: 12, bottom: 28 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const ANIMATION_MS = 800;
const BAR_GAP = 3;
const INCOME_COLOR = "#16a34a";
const EXPENSE_COLOR = "#dc2626";
const TOOLTIP = { width: 170, height: 66 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function monthLabel(month: string) {
  return MONTH_NAMES_SHORT[Number(month.slice(5, 7)) - 1];
}

function monthTitle(month: string) {
  return `${monthLabel(month)} ${month.slice(0, 4)}`;
}

// Lebar diukur dari layout kartu; canvas di-mount ulang (animasi tumbuh diputar lagi) kalau rentang bulan berganti.
export function MonthlyBarChart({ rows }: { rows: MonthlySummaryRow[] }) {
  const [width, setWidth] = useState(0);

  return (
    <View
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      style={{ height: HEIGHT }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <BarCanvas key={`${rows[0]?.month}|${rows[rows.length - 1]?.month}`} rows={rows} width={width} />
      )}
    </View>
  );
}

function BarCanvas({ rows, width }: { rows: MonthlySummaryRow[]; width: number }) {
  const [progress, setProgress] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);

  if (selectedIndex !== null && selectedIndex !== tooltipIndex) setTooltipIndex(selectedIndex);

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

  const count = rows.length;
  const plotWidth = width - PAD.left - PAD.right;
  const band = plotWidth / count;
  const barWidth = Math.min(22, (band - 8 - BAR_GAP) / 2);
  const ticks = computeYTicks(Math.max(0, ...rows.flatMap((row) => [row.income, row.expense])));
  const yMax = ticks[ticks.length - 1];
  const toY = (value: number) => PAD.top + PLOT_HEIGHT * (1 - value / yMax);
  const bandCenter = (index: number) => PAD.left + band * (index + 0.5);
  const baseline = PAD.top + PLOT_HEIGHT;

  const activeIndex = selectedIndex !== null && selectedIndex < count ? selectedIndex : null;

  let tooltipPosition: { left: number; top: number } | null = null;
  if (tooltipIndex !== null && tooltipIndex < count) {
    const row = rows[tooltipIndex];
    const anchorY = toY(Math.max(row.income, row.expense));
    const above = anchorY - TOOLTIP.height - 6;
    tooltipPosition = {
      left: clamp(bandCenter(tooltipIndex) - TOOLTIP.width / 2, 0, width - TOOLTIP.width),
      top: above >= 0 ? above : anchorY + 8,
    };
  }

  function handleTouch(event: GestureResponderEvent) {
    setSelectedIndex(bandIndex(event.nativeEvent.locationX, count, PAD.left, plotWidth));
  }

  function renderBar(value: number, x: number, color: string, index: number) {
    const barHeight = (baseline - toY(value)) * progress;
    if (barHeight <= 0) return null;
    return (
      <Rect
        x={x}
        y={baseline - barHeight}
        width={barWidth}
        height={barHeight}
        rx={3}
        fill={color}
        opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
      />
    );
  }

  return (
    <View style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        {ticks.map((tick) => (
          <G key={tick}>
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={toY(tick)}
              y2={toY(tick)}
              stroke="#e5e5e5"
              strokeDasharray="3 3"
            />
            <SvgText x={PAD.left - 8} y={toY(tick) + 4} fontSize={11} fill="#737373" textAnchor="end">
              {formatCurrencyShort(tick)}
            </SvgText>
          </G>
        ))}

        {rows.map((row, index) => (
          <G key={row.month}>
            {renderBar(row.income, bandCenter(index) - BAR_GAP / 2 - barWidth, INCOME_COLOR, index)}
            {renderBar(row.expense, bandCenter(index) + BAR_GAP / 2, EXPENSE_COLOR, index)}
            <SvgText x={bandCenter(index)} y={HEIGHT - 8} fontSize={11} fill="#737373" textAnchor="middle">
              {monthLabel(row.month)}
            </SvgText>
          </G>
        ))}
      </Svg>

      <View style={StyleSheet.absoluteFill} onTouchStart={handleTouch} onTouchMove={handleTouch} />

      {tooltipIndex !== null && tooltipIndex < count && tooltipPosition && (
        <ChartTooltip visible={activeIndex !== null} {...TOOLTIP} {...tooltipPosition}>
          <Text className="text-xs text-neutral-500">{monthTitle(rows[tooltipIndex].month)}</Text>
          <Text className="text-xs font-medium" style={{ color: INCOME_COLOR }} numberOfLines={1}>
            Pemasukan: {formatCurrency(rows[tooltipIndex].income)}
          </Text>
          <Text className="text-xs font-medium" style={{ color: EXPENSE_COLOR }} numberOfLines={1}>
            Pengeluaran: {formatCurrency(rows[tooltipIndex].expense)}
          </Text>
        </ChartTooltip>
      )}
    </View>
  );
}
