"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCashflowConfigContext } from "../config-context";

/** Section "Mapping Akun" — status mapping akun Retailku (ada/belum),
 * link ke halaman Mapping Akun kalau belum ada satu pun. */
export function MappingStatusSection() {
  const { prerequisites } = useCashflowConfigContext();
  const { mappingsLoading, hasMappings, mappingCount } = prerequisites;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Mapping Akun</h3>
      {mappingsLoading ? (
        <p className="text-muted-foreground text-sm">Memeriksa mapping akun...</p>
      ) : hasMappings ? (
        <p className="text-muted-foreground text-sm">
          {mappingCount} akun Retailku sudah dipetakan. Setiap akun kas Retailku disync ke akun
          lokalnya masing-masing.
        </p>
      ) : (
        <p className="text-destructive text-sm">Belum ada mapping akun Retailku. Lengkapi dulu di Mapping Akun.</p>
      )}
      {!hasMappings && !mappingsLoading && (
        <Button variant="outline" size="sm" render={<Link href="/retailku/mapping" />}>
          Buka Mapping Akun
        </Button>
      )}
    </div>
  );
}
