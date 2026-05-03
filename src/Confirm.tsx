import { useEffect, useRef, useState } from "react";

export type ConfirmProps = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  // When set, the user must type this string to enable the confirm button.
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function Confirm({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  typeToConfirm,
  onConfirm,
  onClose,
}: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const canConfirm = !busy && (typeToConfirm == null || typed === typeToConfirm);

  const run = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="confirm-title">{title}</h2>
        {body && <div className="confirm-body">{body}</div>}
        {typeToConfirm && (
          <label className="confirm-type-label">
            Type <span className="confirm-type-token">{typeToConfirm}</span> to confirm
            <input
              className="confirm-type-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              disabled={busy}
            />
          </label>
        )}
        {err && <p className="auth-err">{err}</p>}
        <div className="confirm-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? "btn-destructive" : "btn-primary"}
            onClick={run}
            disabled={!canConfirm}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
