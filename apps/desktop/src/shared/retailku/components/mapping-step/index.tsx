"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThirdPartyFundFormOutput } from "@/features/third-party/content/data/form/schemas";
import type { TransactionFormOutput } from "@/features/transactions/form/add-edit/schema";
import { RETAILKU_TOOLS } from "../../registry";
import type { RetailkuPackageEntry } from "../../registry/types";
import { useRetailkuDialog } from "../../context";
import { useInnerRetailkuPicker } from "../context";
import { ThirdPartyFundEntryForm } from "./third-party-fund-entry-form";
import { TransactionEntryForm } from "./transaction-entry-form";
import { useSavePackage, type SavePackageEntry } from "./use-save-package";

type EntryResult = ThirdPartyFundFormOutput | TransactionFormOutput | null;

export function MappingStep() {
  const { client, status, selectedTool, selectedItemId, goToBrowseStep } = useInnerRetailkuPicker();
  const { closeDialog } = useRetailkuDialog();
  const tool = selectedTool ? RETAILKU_TOOLS[selectedTool] : undefined;

  const { data: detailRaw } = useQuery({
    queryKey: ["retailku-picker-detail", selectedTool, selectedItemId],
    queryFn: () => tool!.fetchDetail(client!, selectedItemId!),
    enabled: status === "ready" && !!tool && !!selectedItemId,
  });

  const entries: RetailkuPackageEntry[] = detailRaw && tool ? tool.toPackage(detailRaw) : [];

  const [results, setResults] = useState<Record<string, EntryResult>>({});

  function updateResult(entryId: string, values: EntryResult) {
    setResults((prev) => ({ ...prev, [entryId]: values }));
  }

  const allValid = entries.length > 0 && entries.every((entry) => results[entry.id] != null);

  const { mutate: savePackage, isPending: isSaving } = useSavePackage(() => {
    closeDialog();
  });

  function handleSaveAll() {
    const payload: SavePackageEntry[] = entries.map((entry) => ({
      entry,
      values: results[entry.id]!,
    }));
    savePackage(payload);
  }

  return (
    <div className="flex h-128 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada data untuk dipetakan.</p>
        ) : (
          <Tabs defaultValue={entries[0]?.id} className="w-full min-w-0">
            <TabsList>
              {entries.map((entry) => (
                <TabsTrigger key={entry.id} value={entry.id}>
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {entries.map((entry) => (
              <TabsContent key={entry.id} value={entry.id} className="space-y-4">
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
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
      <div className="flex justify-between border-t p-4">
        <Button type="button" variant="outline" onClick={goToBrowseStep} disabled={isSaving}>
          Kembali
        </Button>
        <Button type="button" disabled={!allValid || isSaving} onClick={handleSaveAll}>
          {isSaving ? "Menyimpan..." : `Simpan Semua (${entries.length})`}
        </Button>
      </div>
    </div>
  );
}
