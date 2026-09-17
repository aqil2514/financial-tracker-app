import type { HTMLAttributes, ReactNode } from "react";

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ""}`} {...props}>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
