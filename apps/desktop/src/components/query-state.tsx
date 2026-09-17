interface QueryStateProps {
  isLoading?: boolean;
  error?: unknown;
  loadingText?: string;
}

export function QueryState({
  isLoading,
  error,
  loadingText = "Memuat...",
}: QueryStateProps) {
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{loadingText}</p>;
  }

  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    return <p className="text-destructive text-sm">Gagal memuat: {message}</p>;
  }

  return null;
}
