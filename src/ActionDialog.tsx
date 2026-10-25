import { type FormEvent } from "react";

type NameDialogProps = {
  title: string;
  label: string;
  value: string;
  onChange(value: string): void;
  onSubmit(): void;
  onClose(): void;
};

export function NameDialog({ title, label, value, onChange, onSubmit, onClose }: NameDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <div className="modal-backdrop action-dialog-backdrop" onMouseDown={onClose}>
      <form className="action-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>{title}</h2>
        <label>{label}<input autoFocus maxLength={100} value={value} onChange={(event) => onChange(event.target.value)} /></label>
        <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-action" disabled={!value.trim()}>Salvar</button></footer>
      </form>
    </div>
  );
}

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm(): void;
  onClose(): void;
};

export function ConfirmDialog({ title, description, confirmLabel = "Confirmar", onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop action-dialog-backdrop" onMouseDown={onClose}>
      <section className="action-dialog" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p>{description}</p>
        <footer><button onClick={onClose}>Cancelar</button><button className="danger-action" onClick={onConfirm}>{confirmLabel}</button></footer>
      </section>
    </div>
  );
}
