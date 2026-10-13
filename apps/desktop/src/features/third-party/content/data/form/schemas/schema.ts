import { z } from "zod";

export const thirdPartyFundSchema = z.object({
  direction: z.enum(["in", "out"]),
  account_id: z.string().min(1, "Akun wajib dipilih"),
  contact_name: z.string().min(1, "Nama kontak wajib diisi").nullable(),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type ThirdPartyFundFormValues = z.input<typeof thirdPartyFundSchema>;
export type ThirdPartyFundFormOutput = z.output<typeof thirdPartyFundSchema>;
