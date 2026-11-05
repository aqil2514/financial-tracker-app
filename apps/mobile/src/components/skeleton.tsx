import { useEffect, useState } from "react";
import { Animated } from "react-native";

// Animated bawaan RN (bukan reanimated) — cukup untuk pulse sederhana dan
// tidak menambah ketergantungan ke worklets.
export function Skeleton({ className = "" }: { className?: string }) {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={{ opacity }} className={`rounded-md bg-neutral-200 ${className}`} />;
}
