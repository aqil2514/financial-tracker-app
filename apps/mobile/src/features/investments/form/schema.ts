import { z } from "zod";

const unitField = z.coerce.number().positive("Jumlah unit harus lebih dari 0").nullable();
const priceInputField = z.coerce.number().positive("Harga harus lebih dari 0").nullable();
const priceModeField = z.enum(["unit", "total"]);

type UnitPriceValues = {
  unit: number | null;
  price_mode: "unit" | "total";
  price_input: number | null;
};

// Unit/harga boleh kosong HANYA untuk order pending dari kas (belum tahu nilai finalnya).
function validateUnitAndPrice(values: UnitPriceValues, needsFinalValues: boolean, ctx: z.RefinementCtx) {
  if (needsFinalValues && values.unit == null) {
    ctx.addIssue({ code: "custom", path: ["unit"], message: "Jumlah unit wajib diisi" });
  }
  if (needsFinalValues && values.price_input == null) {
    ctx.addIssue({ code: "custom", path: ["price_input"], message: "Harga wajib diisi" });
  }
  if (values.price_mode === "total" && values.price_input != null && !(values.unit != null && values.unit > 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["price_input"],
      message: "Isi jumlah unit dulu untuk menghitung harga per unit dari total",
    });
  }
}

export const purchaseFormSchema = z
  .object({
    source: z.enum(["cash", "direct"]),
    cash_account_id: z.string().nullable(),
    amount: z.coerce.number().min(0, "Nominal tidak boleh negatif"),
    unit: unitField,
    price_mode: priceModeField,
    price_input: priceInputField,
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string().min(1, "Catatan wajib diisi"),
    status: z.enum(["pending", "settled"]),
  })
  .superRefine((values, ctx) => {
    if (values.source === "cash") {
      if (!values.cash_account_id) {
        ctx.addIssue({ code: "custom", path: ["cash_account_id"], message: "Akun kas wajib dipilih" });
      }
      if (values.amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Nominal harus lebih dari 0" });
      }
    }

    validateUnitAndPrice(values, values.source === "direct" || values.status === "settled", ctx);
  });

export type PurchaseFormValues = z.input<typeof purchaseFormSchema>;
export type PurchaseFormOutput = z.output<typeof purchaseFormSchema>;

export const editPurchaseFormSchema = z
  .object({
    unit: unitField,
    price_mode: priceModeField,
    price_input: priceInputField,
    status: z.enum(["pending", "settled"]),
  })
  .superRefine((values, ctx) => validateUnitAndPrice(values, values.status === "settled", ctx));

export type EditPurchaseFormValues = z.input<typeof editPurchaseFormSchema>;
export type EditPurchaseFormOutput = z.output<typeof editPurchaseFormSchema>;

export const sellFormSchema = z
  .object({
    unit: unitField,
    price_mode: priceModeField,
    price_input: priceInputField,
    date: z.string().min(1, "Tanggal wajib diisi"),
    status: z.enum(["pending", "settled"]),
    cash_account_id: z.string().nullable(),
  })
  .superRefine((values, ctx) => {
    validateUnitAndPrice(values, true, ctx);
    if (values.status === "settled" && !values.cash_account_id) {
      ctx.addIssue({ code: "custom", path: ["cash_account_id"], message: "Akun kas tujuan wajib dipilih" });
    }
  });

export type SellFormValues = z.input<typeof sellFormSchema>;
export type SellFormOutput = z.output<typeof sellFormSchema>;

export const settleSaleFormSchema = z.object({
  cash_account_id: z.string().min(1, "Akun kas tujuan wajib dipilih"),
});

export type SettleSaleFormValues = z.input<typeof settleSaleFormSchema>;
export type SettleSaleFormOutput = z.output<typeof settleSaleFormSchema>;
