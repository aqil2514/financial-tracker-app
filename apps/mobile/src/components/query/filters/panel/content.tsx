import type { Dispatch, SetStateAction } from "react";
import type { FilterConfig } from "../filter.interface";
import { FilterText } from "../text";
import { FilterSelect } from "../select";
import { FilterCombobox } from "../combobox";
import { FilterNumber } from "../number";
import { DEFAULT_OPERATOR } from "./default-operator";
import type { FilterKeyOption, SelectOptionsMap } from "./panel.interface";

interface FilterPanelContentProps {
  config: FilterKeyOption[];
  selectOptions: SelectOptionsMap;
  snapshot: FilterConfig[];
  setSnapshot: Dispatch<SetStateAction<FilterConfig[]>>;
}

// Controlled component murni (terima semua lewat props, tidak baca
// useFilterPanel()) — WAJIB, karena komponen ini dirender sebagai
// children BottomSheetModal, yang di-hoist lewat Portal ke
// BottomSheetModalProvider di root. Portal memutus React Context:
// FilterPanelContext yang di-declare di FilterPanelProvider (nested
// secara JSX) tidak reachable dari dalam modal meski terlihat nested.
// Context tetap dibaca sekali di FilterPanelInner (di luar portal),
// lalu diteruskan ke sini via props. Lihat panel/index.tsx.
export function FilterPanelContent({
  config,
  selectOptions,
  snapshot,
  setSnapshot,
}: FilterPanelContentProps) {
  if (snapshot.length < 1) return null;

  const keyOptions = config;

  const handleChange = (index: number, state: FilterConfig) => {
    setSnapshot((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        // filterKey berganti ke field dengan tipe berbeda (mis. text -> select)
        // -> filterOperator lama (mis. "ilike") bisa jadi tidak valid untuk tipe
        // baru, jadi reset ke default tipe itu supaya operator/value tetap sinkron.
        const oldType = config.find((c) => c.key === item.filterKey)?.type;
        const newType = config.find((c) => c.key === state.filterKey)?.type;
        if (state.filterKey !== item.filterKey && newType && newType !== oldType) {
          return {
            filterKey: state.filterKey,
            filterOperator: DEFAULT_OPERATOR[newType],
            filterValue: null,
          };
        }

        return state;
      })
    );
  };

  const handleRemove = (index: number) => {
    setSnapshot((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      {snapshot.map((snap, i) => {
        const fieldType = config.find((c) => c.key === snap.filterKey)?.type;

        if (fieldType === "text") {
          return (
            <FilterText
              key={i}
              state={snap}
              keyOptions={keyOptions}
              onChange={(state) => handleChange(i, state)}
              onRemove={() => handleRemove(i)}
            />
          );
        }

        if (fieldType === "select") {
          return (
            <FilterSelect
              key={i}
              state={snap}
              keyOptions={keyOptions}
              options={selectOptions[snap.filterKey] ?? []}
              onChange={(state) => handleChange(i, state)}
              onRemove={() => handleRemove(i)}
            />
          );
        }

        if (fieldType === "combobox") {
          return (
            <FilterCombobox
              key={i}
              state={snap}
              keyOptions={keyOptions}
              options={selectOptions[snap.filterKey] ?? []}
              onChange={(state) => handleChange(i, state)}
              onRemove={() => handleRemove(i)}
            />
          );
        }

        if (fieldType === "number") {
          return (
            <FilterNumber
              key={i}
              state={snap}
              keyOptions={keyOptions}
              onChange={(state) => handleChange(i, state)}
              onRemove={() => handleRemove(i)}
            />
          );
        }

        return null;
      })}
    </>
  );
}
