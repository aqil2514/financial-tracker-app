import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

// `key` mengidentifikasi argumen query (bulan, pengelompokan, dst). isLoading
// true selama data yang dimuat belum untuk key saat ini — jadi skeleton
// muncul saat pertama kali dan saat argumen berganti, tapi TIDAK saat
// refetch karena layar kembali fokus (data lama tetap tampil).
// `fetcher` harus stabil (useCallback) dan terikat ke argumen yang sama dengan key.
export function useReportQuery<T>(key: string, fetcher: () => Promise<T>, initial: T) {
  const [state, setState] = useState<{ key: string | null; data: T }>({ key: null, data: initial });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetcher().then((data) => {
        // Cleanup jalan saat key/fetcher berganti, jadi hasil basi diabaikan.
        if (!cancelled) setState({ key, data });
      });
      return () => {
        cancelled = true;
      };
    }, [fetcher, key])
  );

  return { data: state.data, isLoading: state.key !== key };
}
