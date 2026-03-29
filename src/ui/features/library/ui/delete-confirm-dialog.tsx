import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/base';
import { BrButton } from '@/shared/ui/base';

type DeleteConfirmDialogProps = {
  count: number;
  fileName?: string;
  open: boolean;
  collectionMode?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConfirmDialog({
  count,
  fileName,
  open,
  collectionMode,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const isBulk = count > 1;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogContent className="bg-br-input border border-br-elevated text-br-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[13px]">
            {collectionMode
              ? 'Delete Collection'
              : isBulk
                ? `Remove ${count} Photos`
                : 'Remove Photo'}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-br-muted">
            {collectionMode ? (
              <>
                Delete collection <span className="text-br-text">{fileName}</span>? Photos inside
                will be moved back to the library root.
              </>
            ) : isBulk ? (
              `Remove ${count} photos from catalog? Original files will not be deleted.`
            ) : (
              <>
                Remove <span className="text-br-text">{fileName}</span> from catalog? Original file
                will not be deleted.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <BrButton variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </BrButton>
          <BrButton variant="primary" size="sm" onClick={onConfirm}>
            {collectionMode ? 'Delete' : 'Remove'}
          </BrButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
