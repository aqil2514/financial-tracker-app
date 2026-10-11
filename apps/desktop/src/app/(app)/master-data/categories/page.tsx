"use client";

import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { CategoryContent } from "@/features/categories";

export default function CategoriesPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader title="Kategori" description="Kelola kategori transaksi Anda" />
      <CategoryContent />
    </PageContainer>
  );
}
