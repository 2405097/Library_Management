import { useState } from "react";
import "./AccountDeletionDialog.css";

export default function AccountDeletionDialog({ user, open, onClose, onDeleted }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (deleting) return;
    setPassword("");
    setError("");
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!password) {
      setError("Enter your current password to continue.");
      return;
    }

    setDeleting(true);
    setError("");
    try {
      const token = localStorage.getItem("library_token");
      const response = await fetch(`/api/users/${user.userID}/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const data = response.status === 204 ? {} : await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not delete your account.");
      }
      onDeleted();
    } catch (requestError) {
      setError(requestError.message || "Could not delete your account.");
      setDeleting(false);
    }
  };

  return (
    <div className="account-delete-overlay" role="presentation" onMouseDown={handleClose}>
      <section
        className="account-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="account-delete-mark" aria-hidden="true">!</div>
        <p className="account-delete-eyebrow">Danger zone</p>
        <h2 id="account-delete-title">Delete your account?</h2>
        <p className="account-delete-copy">
          This permanently removes your profile, credentials, reviews, and personal collections.
          Your previous borrow and purchase history will remain in the library records as “Deleted user”.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="account-delete-label" htmlFor="account-delete-password">
            Current password
          </label>
          <input
            id="account-delete-password"
            className="account-delete-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            disabled={deleting}
          />
          {error && <p className="account-delete-error" role="alert">{error}</p>}
          <div className="account-delete-actions">
            <button type="button" className="account-delete-cancel" onClick={handleClose} disabled={deleting}>
              Keep account
            </button>
            <button type="submit" className="account-delete-confirm" disabled={deleting}>
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
