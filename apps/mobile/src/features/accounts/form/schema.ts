import { z } from "zod";
import { ACCOUNT_ICON_NAMES } from "@/lib/account-icons";
import { ACCOUNT_COLOR_NAMES } from "@/lib/account-colors";

export const accountFormSchema = z
  .object({
    kind: z.enum(["account", "group"]),
    name: z.string().min(1, "Nama wajib diisi"),
    icon: z.enum(ACCOUNT_ICON_NAMES as [string, ...string[]]).nullable(),
    color: z.enum(ACCOUNT_COLOR_NAMES as [string, ...string[]]).nullable(),
    group_id: z.string().nullable(),
    initial_balance: z.coerce.number(),
    description: z.string().nullable(),
    is_active: z.enum(["true", "false"]),
    account_type: z.enum(["cash", "debt", "investment"]),
    direction: z.enum(["receivable", "payable"]).nullable(),
    unit_label: z.string().nullable(),
    current_market_value: z.coerce.number(),
  })
  .refine(
    (values) => values.kind !== "account" || values.account_type !== "debt" || values.direction != null,
    { message: "Arah piutang/utang wajib diisi", path: ["direction"] }
  )
  .refine(
    (values) =>
      values.kind !== "account" || values.account_type !== "investment" || !!values.unit_label?.trim(),
    { message: "Satuan unit wajib diisi", path: ["unit_label"] }
  );

export type AccountFormValues = z.input<typeof accountFormSchema>;
export type AccountFormOutput = z.output<typeof accountFormSchema>;
