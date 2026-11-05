import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { formatCurrency, formatCurrencyShort } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import {
  bandIndex,
  buildMonotonePath,
  buildMonotoneSegments,
  computeYTicks,
  cumulativeLengths,
  pickLabelIndexes,
} from "./line-chart-geometry";

const HEIGHT = 200;
const LEGEND_HEIGHT = 28;
const PAD = { left: 48, right: 16, top: 16, bottom: 28 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const MAX_X_LABELS = 5;
const ANIMATION_MS = 1000;

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  // Satu nilai per titik-X, urutan sama dengan `labels`.
  values: number[];
}

interface LineSeriesChartProps {
  // Label sumbu-X (sudah diformat) dan judul tooltip per titik.
  labels: string[];
  titles: string[];
  series: LineSeries[];
  showLegend?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Lebar chart diukur dari layout kartunya. Canvas di-mount ulang (animasi muncul diputar lagi)
// kalau bentuk datanya berganti.
export function LineSeriesChart({ labels, titles, series, showLegend }: LineSeriesChartProps) {
  const [width, setWidth] = useState(0);
  const height = HEIGHT + (showLegend ? LEGEND_HEIGHT : 0);

  return (
    <View
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <LineSeriesCanvas
          key={`${labels.length}|${labels[0]}|${labels[labels.length - 1]}|${series.map((s) => s.key).join(",")}`}
          labels={labels}
          titles={titles}
          series={series}
          width={width}
        />
      )}
      {showLegend && (
        <View className="absolute bottom-1 left-0 right-0 flex-row items-center justify-center gap-4">
          {series.map((item) => (
            <View key={item.key} className="flex-row items-center gap-1.5">
              <View className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <Text className="text-xs text-neutral-600">{item.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Grafik garis (satu atau beberapa seri), meniru Recharts di desktop: kurva monotone, grid
// putus-putus, garis tergambar dari kiri ke kanan saat muncul. Sentuh atau seret untuk melihat
// nilai di titik terdekat. Animasi memakai strokeDasharray/offset (bukan ClipPath, yang di Android
// tidak ikut ter-update saat lebarnya berubah per frame); progress di-render ulang per frame.
function LineSeriesCanvas({
  labels,
  titles,
  series,
  width,
}: Omit<LineSeriesChartProps, "showLegend"> & { width: number }) {
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

  const count = labels.length;
  const plotWidth = width - PAD.left - PAD.right;
  const ticks = computeYTicks(Math.max(0, ...series.flatMap((item) => item.values)));
  const yMax = ticks[ticks.length - 1];
  const toY = (value: number) => PAD.top + PLOT_HEIGHT * (1 - value / yMax);
  // Titik di tengah "band" tiap data (seperti sumbu kategori Recharts), bukan menempel ke tepi.
  const toX = (index: number) => PAD.left + (plotWidth * (index + 0.5)) / count;

  const drawn = series.map((item) => {
    const coords = item.values.map((value, index) => ({ x: toX(index), y: toY(value) }));
    const lengths = cumulativeLengths(buildMonotoneSegments(coords), count);
    return { item, coords, path: buildMonotonePath(coords), lengths, total: lengths[lengths.length - 1] };
  });
  const labelIndexes = pickLabelIndexes(count, MAX_X_LABELS);

  const activeIndex = selectedIndex !== null && selectedIndex < count ? selectedIndex : null;
  const tooltipHeight = 30 + 18 * series.length;
  const tooltipWidth = series.length > 1 ? 200 : 130;

  let tooltipPosition: { left: number; top: number } | null = null;
  if (tooltipIndex !== null && tooltipIndex < count) {
    const anchorY = Math.min(...drawn.map((line) => line.coords[tooltipIndex].y));
    const above = anchorY - tooltipHeight - 10;
    tooltipPosition = {
      left: clamp(toX(tooltipIndex) - tooltipWidth / 2, 0, width - tooltipWidth),
      top: above >= 0 ? above : anchorY + 12,
    };
  }

  function handleTouch(event: GestureResponderEvent) {
    setSelectedIndex(bandIndex(event.nativeEvent.locationX, count, PAD.left, plotWidth));
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

        {labelIndexes.map((index) => (
          <SvgText
            key={`${labels[index]}-${index}`}
            x={toX(index)}
            y={HEIGHT - 8}
            fontSize={11}
            fill="#737373"
            textAnchor="middle"
          >
            {labels[index]}
          </SvgText>
        ))}

        {activeIndex !== null && (
          <Line
            x1={toX(activeIndex)}
            x2={toX(activeIndex)}
            y1={PAD.top}
            y2={PAD.top + PLOT_HEIGHT}
            stroke="#a3a3a3"
            strokeDasharray="3 3"
          />
        )}

        {drawn.map((line) => (
          <G key={line.item.key}>
            {line.total > 0 && (
              <Path
                d={line.path}
                stroke={line.item.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={[line.total, line.total]}
                strokeDashoffset={line.total * (1 - progress)}
              />
            )}
            {/* Titik muncul saat ujung garis yang sedang tergambar sampai ke titik itu. */}
            {line.coords.map((coord, index) => {
              const reached = line.total === 0 ? progress > 0 : line.total * progress >= line.lengths[index] - 0.01;
              if (!reached) return null;
              return index === activeIndex ? (
                <Circle
                  key={index}
                  cx={coord.x}
                  cy={coord.y}
                  r={5}
                  fill="#ffffff"
                  stroke={line.item.color}
                  strokeWidth={2}
                />
              ) : (
                <Circle key={index} cx={coord.x} cy={coord.y} r={3} fill={line.item.color} />
              );
            })}
          </G>
        ))}
      </Svg>

      <View style={StyleSheet.absoluteFill} onTouchStart={handleTouch} onTouchMove={handleTouch} />

      {tooltipIndex !== null && tooltipIndex < count && tooltipPosition && (
        <ChartTooltip
          visible={activeIndex !== null}
          width={tooltipWidth}
          height={tooltipHeight}
          {...tooltipPosition}
        >
          <Text className="text-xs text-neutral-500">{titles[tooltipIndex]}</Text>
          {series.map((item) =>
            series.length > 1 ? (
              <Text key={item.key} className="text-xs font-medium" style={{ color: item.color }} numberOfLines={1}>
                {item.label}: {formatCurrency(item.values[tooltipIndex])}
              </Text>
            ) : (
              <Text key={item.key} className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
                {formatCurrency(item.values[tooltipIndex])}
              </Text>
            )
          )}
        </ChartTooltip>
      )}
    </View>
  );
}
