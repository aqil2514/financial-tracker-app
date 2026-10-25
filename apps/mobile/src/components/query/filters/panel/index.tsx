import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { FilterConfig } from "../filter.interface";
import { FilterPanelContent } from "./content";
import { FilterPanelFooter } from "./footer";
import type { FilterKeyOption, SelectOptionsMap } from "./panel.interface";
import { FilterPanelProvider, useFilterPanel } from "./provider";

interface FilterPanelProps {
  config: FilterKeyOption[];
  selectOptions?: SelectOptionsMap;
  initialValue: FilterConfig[];
  onApplyFilter: (state: FilterConfig[]) => void;
}

export function FilterPanel({
  config,
  selectOptions,
  initialValue,
  onApplyFilter,
}: FilterPanelProps) {
  if (config.length < 1) {
    console.warn("[FilterPanel] config minimal 1 item.");
    return null;
  }

  return (
    <FilterPanelProvider
      config={config}
      selectOptions={selectOptions}
      initialValue={initialValue}
      onApplyFilter={onApplyFilter}
    >
      <FilterPanelInner />
    </FilterPanelProvider>
  );
}

function FilterPanelInner() {
  // Dibaca sekali di sini (masih di tree asli, di luar portal
  // BottomSheetModal) lalu diteruskan via props ke FilterPanelContent/
  // FilterPanelFooter — lihat catatan di content.tsx.
  const { config, selectOptions, snapshot, setSnapshot, activeValue, setOpen, onApplyFilter } =
    useFilterPanel();
  const sheetRef = useRef<BottomSheetModal>(null);

  const handlePresent = useCallback(() => {
    // Resync snapshot (draft) dari activeValue (filter yang benar-benar
    // berlaku) setiap sheet dibuka — supaya draft yang ditinggal tanpa
    // "Terapkan Filter" di sesi sebelumnya tidak nyangkut. Dipanggil
    // langsung di sini (bukan lewat useEffect) karena trigger yang
    // pegang ref sheet, jadi tahu persis kapan harus resync.
    setSnapshot(activeValue);
    setOpen(true);
    sheetRef.current?.present();
  }, [setOpen, setSnapshot, activeValue]);

  const handleDismiss = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleClose = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  return (
    <>
      <Pressable
        className="flex-row items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5"
        onPress={handlePresent}
      >
        <Text className="text-sm font-medium text-neutral-900">Filter</Text>
        {activeValue.length > 0 && (
          <View className="min-w-5 items-center rounded-full bg-neutral-900 px-1.5">
            <Text className="text-xs font-medium text-white">{activeValue.length}</Text>
          </View>
        )}
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["100%"]}
        enableDynamicSizing={false}
        onDismiss={handleDismiss}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetScrollView className="flex-1 px-4 pb-4" contentContainerClassName="gap-3">
          <Text className="text-lg font-semibold text-neutral-900">Filter Data</Text>
          <FilterPanelContent
            config={config}
            selectOptions={selectOptions}
            snapshot={snapshot}
            setSnapshot={setSnapshot}
          />
          <FilterPanelFooter
            config={config}
            snapshot={snapshot}
            setSnapshot={setSnapshot}
            onApplyFilter={onApplyFilter}
            onClose={handleClose}
          />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
