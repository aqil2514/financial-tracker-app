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
     * docs/concept/konsep-investasi.md. `unit_label` murni kosmetik (mis.
     * "unit", "lembar", "gram"). `current_market_value` — nilai pasar
     * TOTAL instrumen ini saat ini, diisi manual LANGSUNG oleh user
     * (BUKAN dihitung dari harga per unit × total unit — keputusan
     * 2026-10-06, lihat account-type-investment.md: harga per unit
     * tetap ada tapi turun ke level `investment_purchases` sebagai
     * snapshot historis per-lot, bukan sumber hitung nilai pasar lagi). */
    unit_label: z.string().nullable(),
    current_market_value: z.coerce.number().nullable(),
    /** Nama label (scope 'account', BUKAN id) -- cuma relevan saat
     * `account_type === 'investment'` (jenis instrumen, mis. RDPU/Saham),
     * lihat shared/labels/label-field.tsx. */
    label_names: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.account_type === "investment") {
      if (!values.unit_label?.trim()) {
        ctx.addIssue({ code: "custom", path: ["unit_label"], message: "Satuan unit wajib diisi" });
      }
      if (values.current_market_value == null || values.current_market_value < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["current_market_value"],
          message: "Nilai pasar terkini wajib diisi",
        });
      }
    }
  });

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;
