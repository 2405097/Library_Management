import { useState } from "react";
import "./PasswordChangeForm.css";

export default function PasswordChangeForm({ userID }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const token = sessionStorage.getItem("library_token");
      const response = await fetch(`/api/users/${userID}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not change password.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="password-change-section">
      <button
        type="button"
        className="password-change-trigger"
        onClick={() => {
          setOpen((current) => !current);
          setMessage("");
        }}
        aria-expanded={open}
      >
        {open ? "Cancel password change" : "Change Password"}
      </button>
      {open && (
        <form className="password-change-form" onSubmit={changePassword}>
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {message && <p className="password-change-message" role="status">{message}</p>}
          <button type="submit" className="btn btn-primary small-btn" disabled={saving}>
            {saving ? "Changing..." : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}