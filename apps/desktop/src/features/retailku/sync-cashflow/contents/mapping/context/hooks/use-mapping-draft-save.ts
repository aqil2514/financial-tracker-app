import { isEmptyDoc } from "@/components/rich-text";
import {
  useSaveFieldMapping,
  type SaveFieldMappingInput,
} from "@/shared/retailku";
import {
  UseMappingDraftSaveInput,
  UseMappingDraftSaveOutput,
} from "../interfaces";

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
    const payload: SaveFieldMappingInput = rows
      .filter((row) => drafts[row.key] && row.localAccountId != null)
      .map((row) => ({
        key: row.key,
        retailkuAccountId: row.retailkuAccountId,
        retailkuAccountCode: row.retailkuAccountCode,
        retailkuAccountName: row.accountName,
        localAccountId: row.localAccountId!,
        note: row.note.trim() === "" ? null : row.note,
        categoryId: row.categoryId,
        description: isEmptyDoc(row.description) ? null : JSON.stringify(row.description),
      }));
    if (payload.length === 0) return;
    // SEMENTARA: console.log saja, BELUM ditulis ke DB (selaras dgn
    // DRY_RUN=true di sync-cashflow.ts, investigasi mapping dinamis
    // per-sourceType — lihat docs/todos/plan/retailku-dynamic-sourcetype-mapping.md).
    // Kembalikan ke `saveMapping.mutate(payload, { onSuccess: () => setDrafts({}) });` setelah selesai.
    console.log("[mapping] would save (DRY_RUN)", payload);
  }

  return { isDirty, handleSave, isSaving: saveMapping.isPending };
}
