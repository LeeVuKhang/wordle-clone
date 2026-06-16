import { useEffect, useRef } from 'react';
import './DialogFrame.css';

const DialogFrame = ({
  isOpen,
  onClose,
  overlayClassName,
  contentClassName,
  labelledBy,
  children,
}) => {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const handleBackdropClick = (event) => {
      if (event.target === event.currentTarget) {
        onCloseRef.current?.();
      }
    };

    if (dialog?.showModal) {
      dialog.showModal();
    } else {
      dialog?.setAttribute('open', '');
    }

    dialog?.focus();
    dialog?.addEventListener('click', handleBackdropClick);

    return () => {
      dialog?.removeEventListener('click', handleBackdropClick);

      if (dialog?.open) {
        if (dialog.close) dialog.close();
        else dialog.removeAttribute('open');
      }

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = (event) => {
    event.preventDefault();
    onCloseRef.current?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`app-dialog-frame ${overlayClassName}`}
      aria-labelledby={labelledBy}
      onCancel={handleCancel}
      tabIndex={-1}
    >
      <div className={contentClassName}>
        {children}
      </div>
    </dialog>
  );
};

export default DialogFrame;
