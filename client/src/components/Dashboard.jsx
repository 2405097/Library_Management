import "./Login.css";

export default function Dashboard({ user, onLogout }) {
  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <h2>Welcome, {user.name}!</h2>
            <p className="auth-subtitle">{user.email}</p>
          </div>
          <span className="badge-role">{user.role || "MEMBER"}</span>
        </div>

        <div className="user-info-list">
          <div className="info-row">
            <span className="info-label">User ID:</span>
            <span className="info-value">#{user.userID}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Full Name:</span>
            <span className="info-value">{user.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Email:</span>
            <span className="info-value">{user.email}</span>
          </div>
          {user.phone && (
            <div className="info-row">
              <span className="info-label">Phone:</span>
              <span className="info-value">{user.phone}</span>
            </div>
          )}
          {user.address && (
            <div className="info-row">
              <span className="info-label">Address:</span>
              <span className="info-value">{user.address}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Account Role:</span>
            <span className="info-value">{user.role || "MEMBER"}</span>
          </div>
          {user.createdAt && (
            <div className="info-row">
              <span className="info-label">Member Since:</span>
              <span className="info-value">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {user.lastLogin && (
            <div className="info-row">
              <span className="info-label">Last Login:</span>
              <span className="info-value">
                {new Date(user.lastLogin).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="btn btn-secondary"
          style={{ width: "100%" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
