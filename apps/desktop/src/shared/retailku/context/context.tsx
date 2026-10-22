"use client";

import { createDialogContext } from "@/provider/dialog-state";
import type { RetailkuDialogType } from "./types";

const { DialogProvider, useDialog } = createDialogContext<RetailkuDialogType>();

export { DialogProvider as RetailkuDialogProvider };
export { useDialog as useRetailkuDialog };
