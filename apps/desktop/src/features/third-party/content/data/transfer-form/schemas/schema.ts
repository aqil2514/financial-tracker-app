import { z } from "zod";

/**
 * Transfer `third_party → third_party` — pindah tempat dan/atau pindah
 * kepemilikan (lihat docs/concept/konsep-dana-pihak-ketiga.md, "Pindah
 * tempat dan/atau pindah kepemilikan"). `kind` menentukan field mana yang
 * relevan di UI (lihat ThirdPartyTransferForm) — secara DATA, baik
 * `move_location`/`move_ownership`/`both` sama-sama berakhir sebagai satu
 * transfer dengan akun+kontak asal/tujuan yang independen; `kind` cuma
 * bantuan presentasi form, TIDAK disimpan di `third_party_funds` (kolom
 * itu tidak punya makna sendiri di luar UI, lihat applyThirdPartyTransfer
 * yang cuma butuh 4 pasangan akun+kontak).
 *
 * `destination_account_id`/`destination_contact_name` SELALU field
 * sendiri di schema (bukan dikosongkan lalu di-resolve dari sumber saat
 * submit) — form yang mengisi otomatis sesuai `kind` (lihat
 * useFormTransferSync di form/index.tsx), supaya validasi & nilai yang
 * benar-benar disubmit selalu eksplisit dan konsisten.
 */
export const thirdPartyTransferSchema = z.object({
  kind: z.enum(["move_location", "move_ownership", "both"]),
  source_account_id: z.string().min(1, "Akun asal wajib dipilih"),
  source_contact_name: z.string().min(1, "Nama kontak asal wajib diisi").nullable(),
  destination_account_id: z.string().min(1, "Akun tujuan wajib dipilih"),
  destination_contact_name: z.string().min(1, "Nama kontak tujuan wajib diisi").nullable(),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().min(1, "Catatan wajib diisi"),
});

export type ThirdPartyTransferFormValues = z.input<typeof thirdPartyTransferSchema>;
export type ThirdPartyTransferFormOutput = z.output<typeof thirdPartyTransferSchema>;
