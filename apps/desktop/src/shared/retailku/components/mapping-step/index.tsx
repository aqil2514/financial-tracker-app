"use client";

import { useState } from "react";
import { Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThirdPartyFundFormOutput } from "@/features/third-party/content/data/form/schemas";
import type { TransactionFormOutput } from "@/features/transactions/form/add-edit/schema";
import { useRetailkuDialog } from "../../context";
import { useInnerRetailkuPicker } from "../context";
import { SourceDetailPanel } from "./source-detail-panel";
import { ThirdPartyFundEntryForm } from "./third-party-fund-entry-form";
import { TransactionEntryForm } from "./transaction-entry-form";
import { useSavePackage, type SavePackageEntry } from "./use-save-package";

type EntryResult = ThirdPartyFundFormOutput | TransactionFormOutput | null;

export function MappingStep() {
  const { packageEntries: entries, goToBrowseStep } = useInnerRetailkuPicker();
  const { closeDialog } = useRetailkuDialog();

  const [results, setResults] = useState<Record<string, EntryResult>>({});
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  function updateResult(entryId: string, values: EntryResult) {
    setResults((prev) => ({ ...prev, [entryId]: values }));
  }

  function toggleExcluded(entryId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  const includedEntries = entries.filter((entry) => !excludedIds.has(entry.id));
  const allValid = includedEntries.length > 0 && includedEntries.every((entry) => results[entry.id] != null);

  const { mutate: savePackage, isPending: isSaving } = useSavePackage(() => {
    closeDialog();
  });

  function handleSaveAll() {
    const payload: SavePackageEntry[] = includedEntries.map((entry) => ({
      entry,
      values: results[entry.id]!,
    }));
    savePackage(payload);
  }

  return (
    <div className="flex h-128 w-full min-w-0 flex-col">
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada data untuk dipetakan.</p>
        ) : (
          <Tabs defaultValue={entries[0]?.id} className="w-full min-w-0">
            <ScrollArea className="w-full min-w-0 whitespace-nowrap">
              <TabsList className="w-max min-w-full flex-nowrap justify-start">
                {entries.map((entry) => (
                  <TabsTrigger
                    key={entry.id}
                    value={entry.id}
                    className={excludedIds.has(entry.id) ? "text-muted-foreground shrink-0 line-through" : "shrink-0"}
                  >
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {entries.map((entry) => {
              const isExcluded = excludedIds.has(entry.id);
              return (
                <TabsContent key={entry.id} value={entry.id} keepMounted className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <p className="text-muted-foreground text-sm">
                      {isExcluded ? "Item ini tidak akan disimpan." : "Item ini akan disimpan."}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleExcluded(entry.id)}>
                      {isExcluded ? (
                        <>
                          <Undo2 /> Simpan Lagi
                        </>
                      ) : (
                        <>
                          <Trash2 /> Jangan Simpan
                        </>
                      )}
                    </Button>
                  </div>
                  {isExcluded ? null : (
                    <>
                      {entry.sourceDetail && <SourceDetailPanel detail={entry.sourceDetail} />}
                      {entry.target === "third-party-fund" ? (
                        <ThirdPartyFundEntryForm
                          defaultValues={entry.defaultValues}
                          onChange={(values) => updateResult(entry.id, values)}
                        />
                      ) : (
                        <TransactionEntryForm
                          defaultValues={entry.defaultValues}
                          onChange={(values) => updateResult(entry.id, values)}
                        />
                      )}
                    </>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
      <div className="flex justify-between border-t p-4">
        <Button type="button" variant="outline" onClick={goToBrowseStep} disabled={isSaving}>
          Kembali
        </Button>
        <Button type="button" disabled={!allValid || isSaving} onClick={handleSaveAll}>
          {isSaving ? "Menyimpan..." : `Simpan Semua (${includedEntries.length})`}
        </Button>
      </div>
    </div>
  );
}
