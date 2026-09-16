import { useState } from "react";
import { Spinner } from "./Feedback";
import Modal from "./Modal";

export default function ConfirmDialog({ title, message, confirmLabel = "Confirm", onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      closeDisabled={busy}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy} data-autofocus>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
            {busy && <Spinner />}
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}
