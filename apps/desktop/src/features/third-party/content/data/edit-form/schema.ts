import { z } from "zod";

/**
 * Edit ringkas baris Titip/Ambil (direct, 1 baris) dari `ThirdPartyFundList`
 * — pola sama `edit-payment-form/schema.ts` (shared/debts/). Field
 * "berbahaya" (akun, kontak, arah) SENGAJA TIDAK ada di sini, TETAP
 * terkunci ke nilai asli — cuma Nominal/Tanggal/Catatan yang legal diubah
 * dari dialog ringkas ini. Baris dari transfer (2 baris berpasangan)
 * BELUM dapat dialog edit ini (lihat docs/todos/plan/account-type-third-party.md).
 */
export const editThirdPartyFundSchema = z.object({
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string(),
});

export type EditThirdPartyFundFormValues = z.input<typeof editThirdPartyFundSchema>;
export type EditThirdPartyFundFormOutput = z.output<typeof editThirdPartyFundSchema>;
