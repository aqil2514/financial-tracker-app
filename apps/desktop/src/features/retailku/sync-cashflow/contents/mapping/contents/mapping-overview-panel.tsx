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

export function MappingOverviewPanel() {
  const { rows } = useRetailkuSyncCashflowMapping().candidates;
  const { activeKey, setActiveKey } = useRetailkuSyncCashflowMapping().filter;
  const { categoryOptions, localAccountOptions } =
    useRetailkuSyncCashflowMapping().resources;
  return (
    <div className="rounded-lg border">
      <p className="text-muted-foreground border-b px-3 py-2 text-xs font-medium uppercase tracking-wide">
        Ringkasan semua jenis
      </p>
      <ScrollArea className="h-96">
        <ul className="divide-y">
          {rows.map((row, index) => {
            const isMapped = row.localAccountId != null;
            const accountName = localAccountOptions.find(
              (account) => account.id === row.localAccountId,
            )?.name;
            const categoryName = categoryOptions.find(
              (category) => category.id === row.categoryId,
            )?.name;

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
                    <span className="block truncate font-medium">
                      {row.accountName}
                    </span>
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
                    <dl className="space-y-1 text-xs">
                      <div className="flex gap-1.5">
                        <dt className="opacity-70">Akun tujuan:</dt>
                        <dd className="font-medium">
                          {accountName ?? "Belum dipilih"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="opacity-70">Judul:</dt>
                        <dd>{row.note.trim() || "(judul default)"}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="opacity-70">Kategori:</dt>
                        <dd>{categoryName ?? "Tanpa kategori"}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 opacity-70">Deskripsi:</dt>
                        <dd className="min-w-0">
                          {isEmptyDoc(row.description) ? (
                            "(kosong)"
                          ) : (
                            <RichTextViewer
                              value={row.description!}
                              className="prose-invert text-background"
                            />
                          )}
                        </dd>
                      </div>
                    </dl>
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
