import { z } from "zod";
import { ACCOUNT_TYPES } from "@/lib/account-types";

export const accountSchema = z
  .object({
    name: z.string().min(1, "Nama akun wajib diisi"),
    initial_balance: z.coerce.number(),
    group_id: z.string().nullable(),
    description: z.string().nullable(),
    is_active: z.enum(["1", "0"]),
    account_type: z.enum(ACCOUNT_TYPES),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    /** Hanya relevan saat `account_type === 'investment'` — disimpan di
     * tabel terpisah `investment_accounts` (1:1 dengan `accounts`), lihat
     * docs/concept/konsep-investasi.md bagian "Harga per unit terkini".
     * `unit_label` murni kosmetik (mis. "unit", "lembar", "gram"). */
    unit_label: z.string().nullable(),
    current_price_per_unit: z.coerce.number().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.account_type === "investment") {
      if (!values.unit_label?.trim()) {
        ctx.addIssue({ code: "custom", path: ["unit_label"], message: "Satuan unit wajib diisi" });
      }
      if (values.current_price_per_unit == null || values.current_price_per_unit < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["current_price_per_unit"],
          message: "Harga per unit wajib diisi",
        });
      }
    }
  });

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;
