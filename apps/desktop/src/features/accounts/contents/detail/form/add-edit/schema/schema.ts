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
    unit_label: z.string().nullable(),
    current_market_value: z.coerce.number().nullable(),
    debt_direction: z.enum(["receivable", "payable"]).nullable(),
    forex_country: z.string().nullable(),
    forex_currency: z.string().nullable(),
    forex_current_rate: z.coerce.number().nullable(),
    label_names: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.account_type === "forex") {
      if (!values.forex_country?.trim()) {
        ctx.addIssue({ code: "custom", path: ["forex_country"], message: "Negara wajib diisi" });
      }
      if (!values.forex_currency?.trim()) {
        ctx.addIssue({ code: "custom", path: ["forex_currency"], message: "Mata uang wajib diisi" });
      }
      if (values.forex_current_rate == null || values.forex_current_rate < 0) {
        ctx.addIssue({ code: "custom", path: ["forex_current_rate"], message: "Kurs terkini wajib diisi" });
      }
      // Modal valas berasal dari riwayat beli (unit + kurs), saldo awal tanpa unit membuat average cost 0.
      if (values.initial_balance !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["initial_balance"],
          message: "Akun Valas tidak boleh punya saldo awal, catat lewat pembelian",
        });
      }
    }
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
    if (values.account_type === "debt" && values.debt_direction == null) {
      ctx.addIssue({ code: "custom", path: ["debt_direction"], message: "Arah akun wajib dipilih" });
    }
    if (values.account_type === "third_party" && values.initial_balance !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["initial_balance"],
        message: "Akun Dana Pihak Ketiga tidak boleh punya saldo awal",
      });
    }
  });

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;
