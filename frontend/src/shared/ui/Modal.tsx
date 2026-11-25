import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || !open) {
      return;
    }

    dialog.showModal();

    return () => {
      dialog.close();
    };
  }, [open]);

  return (
    <dialog
      className="modal"
      aria-labelledby={titleId}
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="modal__body">{children}</div>
      <div className="modal__actions">
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </dialog>
  );
}
