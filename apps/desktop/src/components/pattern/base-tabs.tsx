import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export interface BaseTabItems {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface Props {
  items: Array<BaseTabItems>;
  defaultValue?:string
}

export function BaseTabs({ items, defaultValue }: Props) {
    return (
    <Tabs defaultValue={defaultValue ?? items[0]?.value}>
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
