"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryList, CategoryFormDialog } from "@/features/categories";

export default function CategoriesPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader title="Kategori" description="Kelola kategori transaksi Anda" />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kategori</CardTitle>
          <CardAction>
            <CategoryFormDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <CategoryList />
          </Suspense>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
