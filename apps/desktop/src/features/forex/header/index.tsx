"use client";

import { PageHeader } from "@/components/page-header";
import { NewForexAccountDialog } from "./new-forex-account-dialog";

export function ForexHeader() {
  return (
    <PageHeader
      title="Valas"
      description="Pantau mata uang asing yang Anda simpan dan nilainya dalam rupiah"
      actions={<NewForexAccountDialog />}
    />
  );
}
