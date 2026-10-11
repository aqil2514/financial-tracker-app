"use client";

import { createParser, useQueryState } from "nuqs";
import type { DialogState, UseDialogStateReturn } from "../dialog-state";

function createDialogParser<TType extends string>() {
  return createParser<DialogState<TType>>({
    parse(raw) {
      if (!raw) return null;
      const [type, dataId] = raw.split(":") as [TType, string | undefined];
      if (!type) return null;
      return dataId ? { type, dataId } : { type };
    },
    serialize(value) {
      if (!value) return "";
      return value.dataId ? `${value.type}:${value.dataId}` : value.type;
    },
  });
}

export function useDialogQueryState<TType extends string>(
  paramName = "dialog"
): UseDialogStateReturn<TType> {
  const [dialog, setDialog] = useQueryState(paramName, createDialogParser<TType>());

  function openDialog(type: TType, dataId?: string) {
    setDialog({ type, dataId } as DialogState<TType>);
  }

  function closeDialog() {
    setDialog(null);
  }

  function isOpen(type: TType) {
    return dialog?.type === type;
  }

  return { dialog, openDialog, closeDialog, isOpen };
}
