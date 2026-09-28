import { isEmptyDoc } from "@/components/rich-text";
import {
  useSaveFieldMapping,
  type FieldMappingExtraFields,
  type SaveFieldMappingInput,
} from "@/shared/retailku";
import {
  UseMappingDraftSaveInput,
  UseMappingDraftSaveOutput,
} from "../interfaces";

/** Bentuk `extra_fields` SAMA di generic & transfer (toggle "Mengikuti
 * Retailku" utk note/description, lihat `FollowSourceToggle`) — `||
 * undefined` supaya `false` (nilai default) tidak ikut ke-serialize
 * JSON, hasilnya `{}` (bukan `{"noteFollowSource":false,...}`) kalau
 * keduanya OFF, konsisten dgn `useSaveFieldMapping` yg simpan `null`
 * kalau objek kosong. */
function toExtraFields(row: {
  noteFollowSource: boolean;
  descriptionFollowSource: boolean;
}): FieldMappingExtraFields {
  return {
    noteFollowSource: row.noteFollowSource || undefined,
    descriptionFollowSource: row.descriptionFollowSource || undefined,
  };
}

/**
 * Aksi simpan mapping — porting dari `handleSave`/`isDirty`/`isSaving`
 * di `mapping/hooks/use-mapping-draft.ts` (lama). Menerima `rows` (hasil
 * gabungan `use-mapping-candidates`) dan `drafts`/`setDrafts` (state
 * mentah dari `use-draft-state`) sebagai input, BUKAN mengelola state
 * `drafts` sendiri — supaya `drafts` tetap satu sumber kebenaran.
 */
export function useMappingDraftSave({
  rows,
  drafts,
  setDrafts,
}: UseMappingDraftSaveInput): UseMappingDraftSaveOutput {
  const saveMapping = useSaveFieldMapping();

  const isDirty = Object.keys(drafts).length > 0;

  function handleSave() {
    const genericPayload: SaveFieldMappingInput = rows
      .filter(
        (row): row is (typeof rows)[number] & { sourceType: "generic" } =>
          row.sourceType === "generic" && !!drafts[row.key] && row.localAccountId != null
      )
      .map((row) => ({
        key: row.key,
        sourceKind: "generic",
        retailkuAccountId: row.retailkuAccountId,
        retailkuAccountCode: row.retailkuAccountCode,
        retailkuAccountName: row.accountName,
        localAccountId: row.localAccountId!,
        secondaryAccountId: null,
        note: row.note.trim() === "" ? null : row.note,
        categoryId: row.categoryId,
        description: isEmptyDoc(row.description) ? null : JSON.stringify(row.description),
        extraFields: toExtraFields(row),
      }));

    // Varian FUND_TRANSFER — SAMA pola live-sync dgn generic sejak
    // 2026-09-28 (`FundTransferMappingForm` tidak lagi punya tombol
    // submit sendiri) — digabung ke `payload` YANG SAMA (SATU tabel,
    // SATU upsert by `key`).
    const transferPayload: SaveFieldMappingInput = rows
      .filter(
        (row): row is (typeof rows)[number] & { sourceType: "FUND_TRANSFER" } =>
          row.sourceType === "FUND_TRANSFER" &&
          !!drafts[row.key] &&
          row.localAccountId != null &&
          row.secondaryAccountId != null
      )
      .map((row) => ({
        key: row.key,
        sourceKind: "FUND_TRANSFER",
        // `retailku_account_id/code/name` DIRANCANG utk 1 akun (mapping
        // generik, NOT NULL di skema) — transfer punya 2 akun, jadi
        // diisi APA ADANYA dari akun ASAL (`fromAccountId`) sbg
        // representasi, `retailkuAccountName` dibuat deskriptif
        // "Dari → Ke" spy tetap informatif di UI lama yg baca kolom ini
        // (mis. tab lain yg belum sempat disesuaikan). BUKAN solusi
        // final — kalau nanti kolom ini terasa dipaksakan utk sourceType
        // spesial lain juga, pertimbangkan pindah representasi akun
        // sepenuhnya ke `extra_fields` drpd 3 kolom traditional ini.
        retailkuAccountId: row.key.split(":")[1],
        retailkuAccountCode: row.fromAccountName,
        retailkuAccountName: `${row.fromAccountName} → ${row.toAccountName}`,
        localAccountId: row.localAccountId!,
        secondaryAccountId: row.secondaryAccountId!,
        note: row.note.trim() === "" ? null : row.note,
        categoryId: row.categoryId,
        description: isEmptyDoc(row.description) ? null : JSON.stringify(row.description),
        extraFields: toExtraFields(row),
      }));

    // Varian AR_AP — SAMA pola live-sync, digabung ke `payload` yang
    // SAMA. BEDA dari transfer: HANYA 1 akun lokal (`localAccountId`,
    // akun DEBT — lihat `ArApMappingRowDraft`), `secondaryAccountId`
    // SELALU `null` (kolom itu cuma relevan utk transfer). `contactId`
    // WAJIB hanya kalau `contactFollowSource` OFF (fallback statis) —
    // kalau ON, kontak diambil OTOMATIS dari `partyName` per transaksi
    // saat sync nanti (belum diimplementasikan, di luar scope mapping
    // ini), jadi `contactId` boleh kosong. `categoryId` SELALU `null`
    // (BUKAN dari form, field itu TIDAK ADA di `ArApMappingRowDraft`) —
    // kategori tidak applicable utk transaksi AR/AP, lihat JSDoc
    // `ArApMappingRowDraft`.
    const arApPayload: SaveFieldMappingInput = rows
      .filter(
        (row): row is (typeof rows)[number] & { sourceType: "AR_AP" } =>
          row.sourceType === "AR_AP" &&
          !!drafts[row.key] &&
          row.localAccountId != null &&
          (row.contactFollowSource || row.contactId != null)
      )
      .map((row) => ({
        key: row.key,
        sourceKind: "AR_AP",
        // key `ar_ap:<accountId>:<direction>` — `accountId` SAMA persis
        // dgn `retailkuAccountId` (BUKAN "ditambal" seperti transfer,
        // karena AR/AP SEKARANG per akun jurnal SUNGGUHAN, bukan per
        // pihak — lihat `extract-ar-ap-rows.ts`).
        retailkuAccountId: row.key.split(":")[1],
        retailkuAccountCode: row.direction,
        retailkuAccountName: row.accountName,
        localAccountId: row.localAccountId!,
        secondaryAccountId: null,
        note: row.note.trim() === "" ? null : row.note,
        categoryId: null,
        description: isEmptyDoc(row.description) ? null : JSON.stringify(row.description),
        extraFields: {
          contactId: row.contactId ?? undefined,
          contactFollowSource: row.contactFollowSource || undefined,
        },
      }));

    const payload = [...genericPayload, ...transferPayload, ...arApPayload];
    if (payload.length === 0) return;

    saveMapping.mutate(payload, { onSuccess: () => setDrafts({}) });
  }

  return { isDirty, handleSave, isSaving: saveMapping.isPending };
}
