export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  file_path: string;
  created_at: string;
}

export function isPdfAttachment(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}
