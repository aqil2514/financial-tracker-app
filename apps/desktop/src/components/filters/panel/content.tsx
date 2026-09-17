"use client";

import type { FilterConfig } from "../filter.interface";
import { FilterText } from "../text";
import { FilterSelect } from "../select";
import { FilterNumber } from "../number";
// import { FilterDate } from "../date";
import { DEFAULT_OPERATOR } from "./default-operator";
import { useFilterPanel } from "./provider";

export function FilterPanelContent() {
  const { config, selectOptions, snapshot, setSnapshot, onApplyFilter, setOpen } =
    useFilterPanel();

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

  const handleEnter = () => {
    const validFilters = snapshot.filter((f) => f.filterKey !== "");
    onApplyFilter(validFilters);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      {snapshot.map((snap, i) => {
        const fieldType = config.find((c) => c.key === snap.filterKey)?.type;

        if (fieldType === "text") {
          return (
            <FilterText
              key={i}
              state={snap}
              keyOptions={keyOptions}
              onChange={(state) => handleChange(i, state)}
              onEnter={handleEnter}
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

        if (fieldType === "number") {
          return (
            <FilterNumber
              key={i}
              state={snap}
              keyOptions={keyOptions}
              onChange={(state) => handleChange(i, state)}
              onEnter={handleEnter}
              onRemove={() => handleRemove(i)}
            />
          );
        }

        // if (fieldType === "date") {
        //   return (
        //     <FilterDate
        //       key={i}
        //       state={snap}
        //       keyOptions={keyOptions}
        //       onChange={(state) => handleChange(i, state)}
        //       onRemove={() => handleRemove(i)}
        //     />
        //   );
        // }

        return null;
      })}
    </div>
  );
}
