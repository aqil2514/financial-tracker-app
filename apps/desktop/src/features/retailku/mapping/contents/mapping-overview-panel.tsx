import { ScrollArea } from "@/components/ui/scroll-area";
import { useRetailkuSyncCashflowMapping } from "../context";
import { cn } from "cn";
import { formatMappingKeyLabel } from "../utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { isEmptyDoc, RichTextViewer } from "@/components/rich-text";
import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { Category, Contact } from "@/lib/db";
import type {
  ArApMappingRowDraft,
  GenericMappingRowDraft,
  TransferMappingRowDraft,
} from "../context/interfaces";

export function MappingOverviewPanel() {
  const { rows } = useRetailkuSyncCashflowMapping().candidates;
  const { activeKey, setActiveKey } = useRetailkuSyncCashflowMapping().filter;
  const { categoryOptions, localAccountOptions, debtAccountOptions, contactOptions } =
    useRetailkuSyncCashflowMapping().resources;
  return (
    <div className="rounded-lg border">
      <p className="text-muted-foreground border-b px-3 py-2 text-xs font-medium uppercase tracking-wide">
        Ringkasan semua jenis
      </p>
      <ScrollArea className="h-96">
        <ul className="divide-y">
          {rows.map((row, index) => {
            const isMapped =
              row.sourceType === "generic"
                ? row.localAccountId != null
                : row.sourceType === "AR_AP"
                  ? row.localAccountId != null && (row.contactFollowSource || row.contactId != null)
                  : row.localAccountId != null && row.secondaryAccountId != null;
            const title =
              row.sourceType === "generic"
                ? row.accountName
                : row.sourceType === "AR_AP"
                  ? `${row.accountName} (${row.direction === "receivable" ? "Piutang" : "Utang"})`
                  : `${row.fromAccountName} → ${row.toAccountName}`;

            return (
              <li key={row.key} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setActiveKey(row.key)}
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50",
                    row.key === activeKey && "bg-muted",
                  )}
                >
                  <span className="text-muted-foreground w-5 shrink-0 text-right">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {formatMappingKeyLabel(row.key)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      isMapped
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {isMapped ? "Terisi" : "Kosong"}
                  </span>
                </button>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground shrink-0 px-2"
                        aria-label="Lihat detail mapping"
                      />
                    }
                  >
                    <InfoIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-sm">
                    {row.sourceType === "generic" ? (
                      <GenericRowTooltipBody
                        row={row}
                        localAccountOptions={localAccountOptions}
                        categoryOptions={categoryOptions}
                      />
                    ) : row.sourceType === "AR_AP" ? (
                      <ArApRowTooltipBody
                        row={row}
                        debtAccountOptions={debtAccountOptions}
                        contactOptions={contactOptions}
                      />
                    ) : (
                      <TransferRowTooltipBody
                        row={row}
                        localAccountOptions={localAccountOptions}
                        categoryOptions={categoryOptions}
                      />
                    )}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}

function GenericRowTooltipBody({
  row,
  localAccountOptions,
  categoryOptions,
}: {
  row: GenericMappingRowDraft;
  localAccountOptions: AccountWithBalance[];
  categoryOptions: Category[];
}) {
  const accountName = localAccountOptions.find((account) => account.id === row.localAccountId)?.name;
  const categoryName = categoryOptions.find((category) => category.id === row.categoryId)?.name;

  return (
    <dl className="space-y-1 text-xs">
      <div className="flex gap-1.5">
        <dt className="opacity-70">Akun tujuan:</dt>
        <dd className="font-medium">{accountName ?? "Belum dipilih"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Judul:</dt>
        <dd>{row.noteFollowSource ? "(mengikuti Retailku)" : row.note.trim() || "(judul default)"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Kategori:</dt>
        <dd>{categoryName ?? "Tanpa kategori"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="shrink-0 opacity-70">Deskripsi:</dt>
        <dd className="min-w-0">
          {row.descriptionFollowSource ? (
            "(mengikuti Retailku)"
          ) : isEmptyDoc(row.description) ? (
            "(kosong)"
          ) : (
            <RichTextViewer value={row.description!} className="prose-invert text-background" />
          )}
        </dd>
      </div>
    </dl>
  );
}

/** Ringkasan varian FUND_TRANSFER — SAMA field non-fakta (judul/
 * kategori/deskripsi) dgn `GenericRowTooltipBody`, lihat JSDoc
 * `TransferMappingRowDraft`, DITAMBAH ringkasan 2 akun lokal + jumlah
 * transaksi Retailku yg berbagi key ini. */
function TransferRowTooltipBody({
  row,
  localAccountOptions,
  categoryOptions,
}: {
  row: TransferMappingRowDraft;
  localAccountOptions: AccountWithBalance[];
  categoryOptions: Category[];
}) {
  const fromAccountName = localAccountOptions.find((account) => account.id === row.localAccountId)?.name;
  const toAccountName = localAccountOptions.find((account) => account.id === row.secondaryAccountId)?.name;
  const categoryName = categoryOptions.find((category) => category.id === row.categoryId)?.name;

  return (
    <dl className="space-y-1 text-xs">
      <div className="flex gap-1.5">
        <dt className="opacity-70">Dari akun (lokal):</dt>
        <dd className="font-medium">{fromAccountName ?? "Belum dipilih"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Ke akun (lokal):</dt>
        <dd className="font-medium">{toAccountName ?? "Belum dipilih"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Judul:</dt>
        <dd>{row.noteFollowSource ? "(mengikuti Retailku)" : row.note.trim() || "(judul default)"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Kategori:</dt>
        <dd>{categoryName ?? "Tanpa kategori"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="shrink-0 opacity-70">Deskripsi:</dt>
        <dd className="min-w-0">
          {row.descriptionFollowSource ? (
            "(mengikuti Retailku)"
          ) : isEmptyDoc(row.description) ? (
            "(kosong)"
          ) : (
            <RichTextViewer value={row.description!} className="prose-invert text-background" />
          )}
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Transfer Retailku:</dt>
        <dd>
          {row.fromAccountName} → {row.toAccountName} ({row.transactionCount} transaksi)
        </dd>
      </div>
    </dl>
  );
}

/** Ringkasan varian AR_AP — akun DEBT lokal + kontak lokal (BEDA dari
 * varian lain: TIDAK ada field akun kas, toggle "Mengikuti Retailku"
 * di sini beda maksud [kontak, bukan note/description], MAUPUN
 * kategori — lihat JSDoc `ArApMappingRowDraft` kenapa kategori tidak
 * applicable utk AR/AP). */
function ArApRowTooltipBody({
  row,
  debtAccountOptions,
  contactOptions,
}: {
  row: ArApMappingRowDraft;
  debtAccountOptions: AccountWithBalance[];
  contactOptions: Contact[];
}) {
  const accountName = debtAccountOptions.find((account) => account.id === row.localAccountId)?.name;
  const contactName = contactOptions.find((contact) => contact.id === row.contactId)?.name;

  return (
    <dl className="space-y-1 text-xs">
      <div className="flex gap-1.5">
        <dt className="opacity-70">Akun Retailku:</dt>
        <dd className="font-medium">
          {row.accountName} ({row.direction === "receivable" ? "Piutang" : "Utang"})
        </dd>
      </div>
      {row.partyNames.length > 0 && (
        <div className="flex gap-1.5">
          <dt className="shrink-0 opacity-70">Pihak:</dt>
          <dd className="min-w-0">{row.partyNames.join(", ")}</dd>
        </div>
      )}
      <div className="flex gap-1.5">
        <dt className="opacity-70">Akun utang-piutang:</dt>
        <dd className="font-medium">{accountName ?? "Belum dipilih"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Kontak:</dt>
        <dd className="font-medium">
          {row.contactFollowSource ? "(mengikuti Retailku)" : contactName ?? "Belum dipilih"}
        </dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="opacity-70">Judul:</dt>
        <dd>{row.note.trim() || "(judul default)"}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="shrink-0 opacity-70">Deskripsi:</dt>
        <dd className="min-w-0">
          {isEmptyDoc(row.description) ? (
            "(kosong)"
          ) : (
            <RichTextViewer value={row.description!} className="prose-invert text-background" />
          )}
        </dd>
      </div>
    </dl>
  );
}
