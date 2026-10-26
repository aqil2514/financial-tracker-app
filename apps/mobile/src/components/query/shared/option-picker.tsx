import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

export interface OptionPickerOption {
  value: string;
  label: string;
}

export interface OptionPickerRef {
  present: () => void;
}

interface OptionPickerSingleProps {
  multiple?: false;
  searchable?: boolean;
  title: string;
  options: OptionPickerOption[];
  value: string | null;
  onSelect: (value: string) => void;
}

interface OptionPickerMultipleProps {
  multiple: true;
  searchable?: boolean;
  title: string;
  options: OptionPickerOption[];
  value: string[];
  onSelect: (value: string[]) => void;
}

type OptionPickerProps = OptionPickerSingleProps | OptionPickerMultipleProps;

export const OptionPicker = forwardRef<OptionPickerRef, OptionPickerProps>(
  function OptionPicker(props, ref) {
    const { title, options, searchable } = props;
    const sheetRef = useRef<BottomSheetModal>(null);
    const [draft, setDraft] = useState<string[]>(props.multiple ? props.value : []);
    const [query, setQuery] = useState("");

    useImperativeHandle(ref, () => ({
      present: () => {
        if (props.multiple) setDraft(props.value);
        setQuery("");
        sheetRef.current?.present();
      },
    }));

    const filteredOptions = useMemo(() => {
      if (!searchable || query.trim() === "") return options;
      const normalized = query.trim().toLowerCase();
      return options.filter((opt) => opt.label.toLowerCase().includes(normalized));
    }, [options, query, searchable]);

    const handleSelectSingle = useCallback(
      (optionValue: string) => {
        if (props.multiple) return;
        props.onSelect(optionValue);
        sheetRef.current?.dismiss();
      },
      [props]
    );

    const toggleDraft = useCallback((optionValue: string) => {
      setDraft((prev) =>
        prev.includes(optionValue)
          ? prev.filter((v) => v !== optionValue)
          : [...prev, optionValue]
      );
    }, []);

    const handleDone = useCallback(() => {
      if (!props.multiple) return;
      props.onSelect(draft);
      sheetRef.current?.dismiss();
    }, [props, draft]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["60%"]}
        enableDynamicSizing={false}
        stackBehavior="push"
        backdropComponent={(bgProps) => (
          <BottomSheetBackdrop {...bgProps} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetView className="flex-1 px-4 pb-4">
          <Text className="mb-2 text-lg font-semibold text-neutral-900">{title}</Text>
          {searchable && (
            <BottomSheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari..."
              className="mb-2 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          )}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isActive = props.multiple
                ? draft.includes(item.value)
                : item.value === props.value;

              return (
                <Pressable
                  className="flex-row items-center justify-between border-b border-neutral-100 py-3"
                  onPress={() =>
                    props.multiple ? toggleDraft(item.value) : handleSelectSingle(item.value)
                  }
                >
                  <Text className={isActive ? "font-semibold text-neutral-900" : "text-neutral-700"}>
                    {item.label}
                  </Text>
                  {props.multiple && (
                    <View
                      className={
                        isActive
                          ? "size-5 items-center justify-center rounded-sm bg-neutral-900"
                          : "size-5 rounded-sm border border-neutral-300"
                      }
                    >
                      {isActive && <Text className="text-xs text-white">✓</Text>}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
          {props.multiple && (
            <Pressable className="mt-2 items-center rounded-md bg-neutral-900 px-4 py-3" onPress={handleDone}>
              <Text className="font-medium text-white">Selesai</Text>
            </Pressable>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
