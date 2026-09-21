"use client";

import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useImportMoneyManager } from "./use-import-money-manager";

export function ImportMoneyManagerDialog() {
  const {
    filePath,
    summary,
    isPreviewing,
    isImporting,
    pickFile,
    confirmImport,
    reset,
  } = useImportMoneyManager();

  return (
    <>
      <Button variant="outline" onClick={pickFile} disabled={isPreviewing}>
        <Upload className="size-4" />
        {isPreviewing ? "Membaca file..." : "Import dari Money Manager"}
      </Button>

      <AlertDialog open={!!filePath && !!summary} onOpenChange={(open) => !open && reset()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Import Data</AlertDialogTitle>
            <AlertDialogDescription
              render={
                <div className="space-y-2 text-left">
                  <p className="text-destructive font-medium">
                    Semua data akun, grup akun, kategori, dan transaksi yang
                    ada saat ini akan DIHAPUS dan diganti dengan data dari
                    backup ini.
                  </p>
                  {summary && (
                    <ul className="list-inside list-disc">
                      <li>{summary.account_groups} grup akun</li>
                      <li>{summary.accounts} akun</li>
                      <li>{summary.categories} kategori</li>
                      <li>
                        {summary.transactions} transaksi ({summary.income}{" "}
                        pemasukan, {summary.expense} pengeluaran,{" "}
                        {summary.transfer} transfer)
                      </li>
                    </ul>
                  )}
                  {summary &&
                    (summary.unresolved_accounts > 0 ||
                      summary.unresolved_categories > 0 ||
                      summary.unmatched_transfers > 0) && (
                      <p className="text-amber-600">
                        Peringatan: {summary.unresolved_accounts} baris akun
                        tidak dikenali, {summary.unresolved_categories}{" "}
                        kategori tidak dikenali,{" "}
                        {summary.unmatched_transfers} transfer tidak
                        berpasangan. Baris tersebut akan dilewati.
                      </p>
                    )}
                  <p className="text-muted-foreground text-xs">
                    Database saat ini akan dibackup otomatis sebelum diganti.
                  </p>
                </div>
              }
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isImporting}
              onClick={confirmImport}
            >
              {isImporting ? "Mengimpor..." : "Ya, Ganti Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
