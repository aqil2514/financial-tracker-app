import { z } from "zod";

export const recordFundFormSchema = z
  .object({
    direction: z.enum(["in", "out"]),
    account_id: z.string().nullable(),
    contact_id: z.string().nullable(),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.account_id) {
      ctx.addIssue({ code: "custom", path: ["account_id"], message: "Akun wajib dipilih" });
    }
    if (!values.contact_id) {
      ctx.addIssue({ code: "custom", path: ["contact_id"], message: "Kontak wajib dipilih" });
    }
  });

export type RecordFundFormValues = z.input<typeof recordFundFormSchema>;
export type RecordFundFormOutput = z.output<typeof recordFundFormSchema>;

// Akun, kontak, dan arah terkunci (tidak ada di form edit); hanya ketiga field ini yang legal diubah.
export const editFundFormSchema = z.object({
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  date: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string(),
});

export type EditFundFormValues = z.input<typeof editFundFormSchema>;
export type EditFundFormOutput = z.output<typeof editFundFormSchema>;

// kind murni presentasi form (tidak disimpan): menentukan field mana yang tampil dan mana yang otomatis
// disamakan dengan sisi asal (lihat resolveMoveDestination).
export const moveFundFormSchema = z
  .object({
    kind: z.enum(["move_location", "move_ownership", "both"]),
    source_account_id: z.string().nullable(),
    source_contact_id: z.string().nullable(),
    destination_account_id: z.string().nullable(),
    destination_contact_id: z.string().nullable(),
    amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
    date: z.string().min(1, "Tanggal wajib diisi"),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    const required: [keyof typeof values, string][] = [
      ["source_account_id", "Akun asal wajib dipilih"],
      ["source_contact_id", "Kontak asal wajib dipilih"],
    ];
    if (values.kind !== "move_ownership") {
      required.push(["destination_account_id", "Akun tujuan wajib dipilih"]);
    }
    if (values.kind !== "move_location") {
      required.push(["destination_contact_id", "Kontak tujuan wajib dipilih"]);
    }
    for (const [field, message] of required) {
      if (!values[field]) ctx.addIssue({ code: "custom", path: [field], message });
    }

    const destination = resolveMoveDestination(values);
    if (
      values.source_account_id &&
      values.source_contact_id &&
      destination.accountId === values.source_account_id &&
      destination.contactId === values.source_contact_id
    ) {
      const path = values.kind === "move_ownership" ? "destination_contact_id" : "destination_account_id";
      ctx.addIssue({ code: "custom", path: [path], message: "Tujuan sama dengan asal — tidak ada yang dipindahkan" });
    }
  });

export type MoveFundFormValues = z.input<typeof moveFundFormSchema>;
export type MoveFundFormOutput = z.output<typeof moveFundFormSchema>;

// Pindah tempat: kontak tujuan = kontak asal. Pindah kepemilikan: akun tujuan = akun asal. Keduanya: apa adanya.
export function resolveMoveDestination(values: {
  kind: "move_location" | "move_ownership" | "both";
  source_account_id: string | null;
  source_contact_id: string | null;
  destination_account_id: string | null;
  destination_contact_id: string | null;
}) {
  return {
    accountId: values.kind === "move_ownership" ? values.source_account_id : values.destination_account_id,
    contactId: values.kind === "move_location" ? values.source_contact_id : values.destination_contact_id,
  };
}
