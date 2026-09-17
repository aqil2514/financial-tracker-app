import type { HTMLAttributes } from "react";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: "3xl" | "6xl";
}

const MAX_WIDTH_CLASS: Record<NonNullable<PageContainerProps["maxWidth"]>, string> = {
  "3xl": "max-w-3xl",
  "6xl": "max-w-6xl",
};

export function PageContainer({
  maxWidth = "3xl",
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto space-y-6 ${MAX_WIDTH_CLASS[maxWidth]} ${className ?? ""}`}
      {...props}
    />
  );
}
