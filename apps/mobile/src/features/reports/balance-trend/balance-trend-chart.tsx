import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { formatCurrency, formatCurrencyShort } from "@/lib/utils";
import { ChartTooltip } from "../shared/chart-tooltip";
import {
  buildMonotonePath,
  buildMonotoneSegments,
  computeNiceTicks,
  cumulativeLengths,
  nearestIndex,
  pickLabelIndexes,
  spreadX,
} from "../shared/line-chart-geometry";
import { formatPointLabel, formatPointTooltip } from "./balance-trend-labels";
import type { BalanceTrendPoint, Granularity } from "./balance-trend-query";

const HEIGHT = 240;
const PAD = { left: 56, right: 28, top: 16, bottom: 28 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const MAX_X_LABELS = 5;
const ANIMATION_MS = 1000;
const TOOLTIP_WIDTH = 150;
const TOOLTIP_HEIGHT = 48;
const COLOR = "#2563eb";

interface BalanceTrendChartProps {
  points: BalanceTrendPoint[];
  granularity: Granularity;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Lebar chart diukur dari layout kartunya. `key` memaksa canvas di-mount ulang (animasi
// muncul diputar lagi) saat granularitas atau rentang datanya berganti.
export function BalanceTrendChart({ points, granularity }: BalanceTrendChartProps) {
  const [width, setWidth] = useState(0);

  return (
    <View
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      style={{ height: HEIGHT }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <BalanceTrendCanvas
          key={`${granularity}|${points.length}|${points[0]?.label}|${points[points.length - 1]?.label}`}
          points={points}
          granularity={granularity}
          width={width}
        />
      )}
    </View>
  );
}

// Grafik area saldo, meniru AreaChart Recharts di desktop: kurva monotone dengan isi gradien,
// grid putus-putus, garis tergambar dari kiri ke kanan saat muncul. Sentuh atau seret di
// grafik untuk melihat saldo di titik terdekat. Animasi garis memakai strokeDasharray/offset
// (bukan ClipPath, yang tidak ikut ter-update di Android).
function BalanceTrendCanvas({ points, granularity, width }: BalanceTrendChartProps & { width: number }) {
  const [progress, setProgress] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Tooltip memegang indeks terakhir supaya bisa memudar keluar.
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

  const plotWidth = width - PAD.left - PAD.right;
  const balances = points.map((point) => point.balance);
  // Sumbu selalu memuat 0 supaya garis saldo nol jelas, juga saat saldo negatif.
  const ticks = computeNiceTicks(Math.min(0, ...balances), Math.max(0, ...balances));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const toY = (value: number) => PAD.top + PLOT_HEIGHT * (1 - (value - yMin) / (yMax - yMin));
  const baselineY = toY(0);

  const coords = points.map((point, index) => ({
    x: spreadX(index, points.length, PAD.left, plotWidth),
    y: toY(point.balance),
  }));
  const segments = buildMonotoneSegments(coords);
  const linePath = buildMonotonePath(coords);
  const lengths = cumulativeLengths(segments, points.length);
  const totalLength = lengths[lengths.length - 1];
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`
      : "";
  const labelIndexes = pickLabelIndexes(points.length, MAX_X_LABELS);

  const activeIndex = selectedIndex !== null && selectedIndex < points.length ? selectedIndex : null;
  const tooltipPoint = tooltipIndex !== null ? points[tooltipIndex] : undefined;
  const tooltipCoord = tooltipIndex !== null ? coords[tooltipIndex] : undefined;

  let tooltipPosition: { left: number; top: number } | null = null;
  if (tooltipCoord) {
    const above = tooltipCoord.y - TOOLTIP_HEIGHT - 12;
    tooltipPosition = {
      left: clamp(tooltipCoord.x - TOOLTIP_WIDTH / 2, 0, width - TOOLTIP_WIDTH),
      top: above >= 0 ? above : tooltipCoord.y + 14,
    };
  }

  function handleTouch(event: GestureResponderEvent) {
    setSelectedIndex(nearestIndex(event.nativeEvent.locationX, points.length, PAD.left, plotWidth));
  }

  return (
    <>
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id="balanceTrendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.05" stopColor={COLOR} stopOpacity={0.3} />
            <Stop offset="0.95" stopColor={COLOR} stopOpacity={0} />
          </LinearGradient>
        </Defs>

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

        {labelIndexes.map((index) => (
          <SvgText
            key={points[index].label}
            x={coords[index].x}
            y={HEIGHT - 8}
            fontSize={11}
            fill="#737373"
            textAnchor="middle"
          >
            {formatPointLabel(points[index].label, granularity)}
          </SvgText>
        ))}

        {areaPath !== "" && <Path d={areaPath} fill="url(#balanceTrendFill)" fillOpacity={progress} />}

        {totalLength > 0 && (
          <Path
            d={linePath}
            stroke={COLOR}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[totalLength, totalLength]}
            strokeDashoffset={totalLength * (1 - progress)}
          />
        )}

        {points.length === 1 && progress > 0 && <Circle cx={coords[0].x} cy={coords[0].y} r={3} fill={COLOR} />}

        {activeIndex !== null && (
          <>
            <Line
              x1={coords[activeIndex].x}
              x2={coords[activeIndex].x}
              y1={PAD.top}
              y2={PAD.top + PLOT_HEIGHT}
              stroke="#a3a3a3"
              strokeDasharray="3 3"
            />
            <Circle
              cx={coords[activeIndex].x}
              cy={coords[activeIndex].y}
              r={5}
              fill="#ffffff"
              stroke={COLOR}
              strokeWidth={2}
            />
          </>
        )}
      </Svg>

      <View style={StyleSheet.absoluteFill} onTouchStart={handleTouch} onTouchMove={handleTouch} />

      {tooltipPoint && tooltipPosition && (
        <ChartTooltip
          visible={activeIndex !== null}
          width={TOOLTIP_WIDTH}
          height={TOOLTIP_HEIGHT}
          {...tooltipPosition}
        >
          <Text className="text-xs text-neutral-500">{formatPointTooltip(tooltipPoint.label, granularity)}</Text>
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {formatCurrency(tooltipPoint.balance)}
          </Text>
        </ChartTooltip>
      )}
    </>
  );
}
