export interface Point {
  x: number;
  y: number;
}

export interface BezierSegment {
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
}

// Tick sumbu-Y "bagus" untuk rentang [min, max] dengan langkah s = 1/2/5 × 10^k, mulai dari kelipatan s
// di bawah min sampai kelipatan s di atas max. Seperti domain otomatis Recharts. Rentang kosong
// (min = max) memberi sumbu default.
export function computeNiceTicks(min: number, max: number, targetCount = 4): number[] {
  const span = max - min;
  if (!(span > 0)) return [0, 1];

  const rawStep = span / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;

  const first = Math.floor(min / step);
  const last = Math.ceil(max / step);
  const ticks: number[] = [];
  for (let i = first; i <= last; i++) ticks.push(i * step);
  return ticks;
}

// Sumbu-Y yang mulai dari 0 (nilai tidak negatif).
export function computeYTicks(max: number, targetCount = 4): number[] {
  return computeNiceTicks(0, max, targetCount);
}

// Segmen kurva monotone-X (seperti `type="monotone"` Recharts / d3 curveMonotoneX): halus,
// tidak melampaui nilai titik (tidak ada overshoot di antara titik). Kosong kalau titik < 2.
export function buildMonotoneSegments(points: Point[]): BezierSegment[] {
  const n = points.length;
  if (n < 2) return [];

  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    slopes.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x));
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }

  // Fritsch–Carlson: jepit tangen supaya kurva tetap monotone.
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const sum = a * a + b * b;
    if (sum > 9) {
      const scale = 3 / Math.sqrt(sum);
      tangents[i] = scale * a * slopes[i];
      tangents[i + 1] = scale * b * slopes[i];
    }
  }

  return points.slice(0, -1).map((p0, i) => {
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;
    return {
      p0,
      c1: { x: p0.x + dx, y: p0.y + tangents[i] * dx },
      c2: { x: p1.x - dx, y: p1.y - tangents[i + 1] * dx },
      p1,
    };
  });
}

export function buildMonotonePath(points: Point[]): string {
  if (points.length === 0) return "";
  const segments = buildMonotoneSegments(points);

  return segments.reduce(
    (path, s) => `${path} C ${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.p1.x} ${s.p1.y}`,
    `M ${points[0].x} ${points[0].y}`
  );
}

function bezierPoint(s: BezierSegment, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p1.x,
    y: u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y,
  };
}

// Panjang busur tiap segmen (didekati dengan polyline), dipakai untuk animasi "tergambar".
export function segmentLengths(segments: BezierSegment[], steps = 24): number[] {
  return segments.map((segment) => {
    let length = 0;
    let previous = segment.p0;
    for (let i = 1; i <= steps; i++) {
      const point = bezierPoint(segment, i / steps);
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    return length;
  });
}

// Panjang kurva dari titik pertama sampai tiap titik data (indeks 0 = 0). Elemen terakhir = panjang total.
export function cumulativeLengths(segments: BezierSegment[], pointCount: number): number[] {
  const cumulative = [0];
  let total = 0;
  for (const length of segmentLengths(segments)) {
    total += length;
    cumulative.push(total);
  }
  while (cumulative.length < pointCount) cumulative.push(total);
  return cumulative;
}

// Indeks titik yang labelnya ditampilkan di sumbu-X, maksimal `maxLabels`, selalu menyertakan titik pertama.
export function pickLabelIndexes(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  const step = Math.ceil(count / maxLabels);
  const indexes: number[] = [];
  for (let i = 0; i < count; i += step) indexes.push(i);
  return indexes;
}

// Posisi-X titik ke-`index` dari `count` titik yang tersebar rata dari tepi kiri ke tepi kanan
// area plot (seperti AreaChart Recharts); satu titik diletakkan di tengah.
export function spreadX(index: number, count: number, left: number, plotWidth: number): number {
  return count <= 1 ? left + plotWidth / 2 : left + (plotWidth * index) / (count - 1);
}

// Indeks titik terdekat ke posisi sentuh `x`, dijepit ke rentang yang valid.
export function nearestIndex(x: number, count: number, left: number, plotWidth: number): number {
  if (count <= 1) return 0;
  const ratio = (x - left) / plotWidth;
  return Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1);
}

// Indeks "band" (sumbu kategori) tempat posisi sentuh `x` jatuh, dijepit ke rentang yang valid.
// Pasangan toX band-tengah: titik ke-i berada di tengah band ke-i.
export function bandIndex(x: number, count: number, left: number, plotWidth: number): number {
  if (count <= 1) return 0;
  const index = Math.floor(((x - left) / plotWidth) * count);
  return Math.min(Math.max(index, 0), count - 1);
}
