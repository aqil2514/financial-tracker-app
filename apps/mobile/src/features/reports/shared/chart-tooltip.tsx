import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing } from "react-native";

const TOOLTIP_MS = 180;

interface ChartTooltipProps {
  // false = memudar keluar. Pemanggil memberi `key` berbeda tiap pilihan baru supaya
  // tooltip di-mount ulang dan animasi munculnya diputar lagi di posisi baru.
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  children: ReactNode;
}

// Tooltip grafik: memudar sambil naik pelan dan membesar sedikit saat muncul, kebalikannya saat hilang.
export function ChartTooltip({ visible, left, top, width, height, children }: ChartTooltipProps) {
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: TOOLTIP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center rounded-md border border-neutral-200 bg-white px-2 py-1 shadow"
      style={{
        left,
        top,
        width,
        height,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
