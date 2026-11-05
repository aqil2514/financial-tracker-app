import { useEffect, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { formatCurrency, formatCurrencyShort, formatShortDate, MONTH_NAMES_SHORT } from "@/lib/utils";
import { ChartTooltip } from "../../shared/chart-tooltip";
import {
  buildMonotoneSegments,
  buildMonotonePath,
  computeYTicks,
  cumulativeLengths,
  pickLabelIndexes,
} from "../../shared/line-chart-geometry";

const HEIGHT = 200;
const PAD = { left: 48, right: 16, top: 16, bottom: 28 };
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;
const MAX_X_LABELS = 5;
const ANIMATION_MS = 1000;
const TOOLTIP_WIDTH = 130;
const TOOLTIP_HEIGHT = 48;

interface DailyChartProps {
  points: { date: string; total: number }[];
  color: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Lebar chart diukur dari layout kartunya (bukan dihitung dari lebar layar) supaya
// pas dengan kartu lain di halaman.
export function DailyChart({ points, color }: DailyChartProps) {
  const [width, setWidth] = useState(0);

  if (points.length === 0) {
    return <Text className="py-6 text-center text-sm text-neutral-500">Belum ada data.</Text>;
  }

  return (
    <View
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      style={{ height: HEIGHT }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && <DailyChartCanvas points={points} color={color} width={width} />}
    </View>
  );
}

// Grafik garis total harian, meniru Recharts di desktop: kurva monotone, grid putus-putus,
// garis tergambar dari kiri ke kanan saat muncul, dan titik bisa disentuh untuk melihat
// total hari itu. Digambar dengan react-native-svg; progress animasi di-render ulang per frame.
// Efek "tergambar" memakai strokeDasharray/offset (bukan ClipPath, yang di Android tidak
// ikut ter-update saat lebarnya berubah per frame).
function DailyChartCanvas({ points, color, width }: DailyChartProps & { width: number }) {
  const [progress, setProgress] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Tooltip memegang indeks terakhir supaya bisa memudar keluar saat pilihan dibatalkan.
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
  const ticks = computeYTicks(Math.max(...points.map((point) => point.total)));
  const yMax = ticks[ticks.length - 1];
  const toY = (value: number) => PAD.top + PLOT_HEIGHT * (1 - value / yMax);
  // Titik di tengah "band" tiap data (seperti sumbu kategori Recharts), bukan menempel ke tepi.
  const toX = (index: number) => PAD.left + (plotWidth * (index + 0.5)) / points.length;

  const coords = points.map((point, index) => ({ x: toX(index), y: toY(point.total) }));
  const segments = buildMonotoneSegments(coords);
  const linePath = buildMonotonePath(coords);
  const lengths = cumulativeLengths(segments, points.length);
  const totalLength = lengths[lengths.length - 1];
  const drawnLength = totalLength * progress;
  const labelIndexes = pickLabelIndexes(points.length, MAX_X_LABELS);

  const activeIndex = selectedIndex !== null && selectedIndex < points.length ? selectedIndex : null;
  const tooltipPoint = tooltipIndex !== null ? points[tooltipIndex] : undefined;
  const tooltipCoord = tooltipIndex !== null ? coords[tooltipIndex] : undefined;

  let tooltipPosition: { left: number; top: number } | null = null;
  if (tooltipCoord) {
    const above = tooltipCoord.y - TOOLTIP_HEIGHT - 10;
    tooltipPosition = {
      left: clamp(tooltipCoord.x - TOOLTIP_WIDTH / 2, 0, width - TOOLTIP_WIDTH),
      top: above >= 0 ? above : tooltipCoord.y + 12,
    };
  }

  return (
    <>
      <Svg width={width} height={HEIGHT}>
        <Rect width={width} height={HEIGHT} fill="transparent" onPress={() => setSelectedIndex(null)} />

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

        {labelIndexes.map((index) => {
          const [, month, day] = points[index].date.split("-").map(Number);
          return (
            <SvgText
              key={points[index].date}
              x={coords[index].x}
              y={HEIGHT - 8}
              fontSize={11}
              fill="#737373"
              textAnchor="middle"
            >
              {`${day} ${MONTH_NAMES_SHORT[month - 1]}`}
            </SvgText>
          );
        })}

        {activeIndex !== null && (
          <Line
            x1={coords[activeIndex].x}
            x2={coords[activeIndex].x}
            y1={PAD.top}
            y2={PAD.top + PLOT_HEIGHT}
            stroke="#a3a3a3"
            strokeDasharray="3 3"
          />
        )}

        {totalLength > 0 && (
          <Path
            d={linePath}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[totalLength, totalLength]}
            strokeDashoffset={totalLength - drawnLength}
          />
        )}

        {/* Titik muncul saat ujung garis yang sedang tergambar sampai ke titik itu. */}
        {coords.map((coord, index) => {
          const reached = totalLength === 0 ? progress > 0 : drawnLength >= lengths[index] - 0.01;
          if (!reached) return null;
          return index === activeIndex ? (
            <Circle key={index} cx={coord.x} cy={coord.y} r={5} fill="#ffffff" stroke={color} strokeWidth={2} />
          ) : (
            <Circle key={index} cx={coord.x} cy={coord.y} r={3} fill={color} />
          );
        })}

        {coords.map((coord, index) => (
          <Circle
            key={`hit-${index}`}
            cx={coord.x}
            cy={coord.y}
            r={16}
            fill="transparent"
            onPress={() => setSelectedIndex(index === activeIndex ? null : index)}
          />
        ))}
      </Svg>

      {tooltipPoint && tooltipPosition && (
        <ChartTooltip
          key={tooltipIndex}
          visible={activeIndex !== null}
          width={TOOLTIP_WIDTH}
          height={TOOLTIP_HEIGHT}
          {...tooltipPosition}
        >
          <Text className="text-xs text-neutral-500">{formatShortDate(tooltipPoint.date)}</Text>
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {formatCurrency(tooltipPoint.total)}
          </Text>
        </ChartTooltip>
      )}
    </>
  );
}
