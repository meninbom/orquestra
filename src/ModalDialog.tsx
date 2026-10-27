import { useEffect, useRef, useState, type ReactNode } from "react";
import "./modal-dialog.css";

/** True while a native modal dialog is active; call before handling editor shortcuts. */
export function isModalDialogOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

type Props = {
  className?: string;
  label: string;
  onClose(): void;
  children: ReactNode;
  closeOnBackdrop?: boolean;
};

export function ModalDialog({ className = "", label, onClose, children, closeOnBackdrop = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Capture during render, before autoFocus or showModal can move focus.
  const [opener] = useState<HTMLElement | null>(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Native dialog contains Tab, makes the rest of the document inert and restores focus.
    const cancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    const click = (event: MouseEvent) => {
      if (closeOnBackdrop && event.target === dialog) closeRef.current();
    };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("click", click);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.removeEventListener("click", click);
      if (dialog.open) dialog.close();
      // Some engines/tests do not restore focus when a dialog is disconnected.
      // For nested dialogs, restore only inside the still-open parent dialog.
      if (opener?.isConnected) {
        const openDialogs = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")];
        const activeTop = openDialogs.at(-1);
        if (!activeTop || activeTop.contains(opener)) opener.focus({ preventScroll: true });
      }
    };
  }, [closeOnBackdrop, opener]);
  return <dialog ref={ref} className={`app-modal-dialog ${className}`} aria-label={label}>{children}</dialog>;
}
