export type DialogState<TType extends string> =
  | { type: TType; dataId: string }
  | { type: TType; dataId?: undefined }
  | null;

export interface UseDialogStateReturn<TType extends string> {
  dialog: DialogState<TType>;
  openDialog: (type: TType, dataId?: string) => void;
  closeDialog: () => void;
  isOpen: (type: TType) => boolean;
}
