"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import type { BaseTabItems } from "./base-tabs";

interface Props {
  items: Array<BaseTabItems>;
  defaultValue?: string;
  urlParam?: string;
}

export function BaseTabsUrl({ items, defaultValue, urlParam = "tab" }: Props) {
  const values = items.map((item) => item.value);
  const [activeTab, setActiveTab] = useQueryState(
    urlParam,
    parseAsStringEnum(values).withDefault(defaultValue ?? items[0]?.value ?? "")
  );

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)}>
      <TabsList>
        {items.map((tab, i) => (
          <TabsTrigger value={tab.value} key={`tab-${i}`}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((tab) => (
        <TabsContent value={tab.value} key={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
