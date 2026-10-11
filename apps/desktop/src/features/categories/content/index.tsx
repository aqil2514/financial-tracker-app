import { BaseTabItems, BaseTabs } from "@/components/pattern/base-tabs";
import { CategoryListSection } from "./list";
import { CategoryPeriodSection } from "./period";

const categoryTabs: BaseTabItems[] = [
  {
    value: "list",
    label: "Daftar Kategori",
    content: <CategoryListSection />,
  },
  {
    value: "period",
    label: "Periode",
    content: <CategoryPeriodSection />,
  },
];

export function CategoryContent() {
  return <BaseTabs items={categoryTabs} />;
}
