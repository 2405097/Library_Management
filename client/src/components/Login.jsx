import { useState } from "react";
import "./Login.css";

export default function Login({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [accountType, setAccountType] = useState("MEMBER");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errorMessage) setErrorMessage("");
  };

  const toggleMode = () => {
    setIsLoginMode((prev) => !prev);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const role = accountType === "ADMIN" ? "ADMIN" : "MEMBER";

      if (isLoginMode) {
        const response = await fetch("/api/users/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email.trim(),
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Invalid email or password");
        }

        if (data.user.role !== role) {
          throw new Error(
            role === "ADMIN"
              ? "This account is not an admin account."
              : "This account is not a member account."
          );
        }

        setSuccessMessage("Login successful!");
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim(),
            role,
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to create account");
        }

        setSuccessMessage("Account created successfully! Please sign in.");
        setIsLoginMode(true);
        setFormData((prev) => ({
          ...prev,
          password: "",
        }));
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="auth-brand-icon">📚</span>
        <span className="auth-brand-name">LibraryMS</span>
      </div>

      <div className="auth-card">
        <div className="auth-card-inner">
          {/* Left decorative panel */}
          <div className="auth-panel-left">
            <div className="auth-panel-content">
              <h1>Your Library,<br />Anytime.</h1>
              <p>Search thousands of books, manage your borrows, write reviews and more — all in one place.</p>
              <ul className="auth-feature-list">
                <li>📖 Browse &amp; search books</li>
                <li>🔖 Track borrow records</li>
                <li>⭐ Write book reviews</li>
                <li>🛒 Order books online</li>
              </ul>
            </div>
          </div>

          {/* Right form panel */}
          <div className="auth-panel-right">
            <div className="auth-form-header">
              <h2>{isLoginMode ? "Welcome back" : "Create account"}</h2>
              <p className="auth-subtitle">
                {isLoginMode
                  ? "Sign in to continue to the library"
                  : "Fill in your details to get started"}
              </p>
            </div>

            {errorMessage && (
              <div className="alert alert-danger" role="alert">
                ⚠ {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success" role="alert">
                ✓ {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {!isLoginMode && (
                <>
                  <div className="form-group">
                    <label htmlFor="name">Full Name <span className="required">*</span></label>
                    <input
                      id="name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Jane Doe"
                      required
                      autoComplete="name"
                      className="form-control"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="phone">Phone</label>
                      <input
                        id="phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+880..."
                        autoComplete="tel"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="address">Address</label>
                      <input
                        id="address"
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="City, Country"
                        autoComplete="street-address"
                        className="form-control"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="email">Email Address <span className="required">*</span></label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="user@example.com"
                  required
                  autoComplete="email"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password <span className="required">*</span></label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role <span className="required">*</span></label>
                <div className="select-wrapper">
                  <select
                    id="role"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="form-control"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <span className="select-arrow">▾</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
              >
                {loading
                  ? isLoginMode
                    ? "Signing in..."
                    : "Creating account..."
                  : isLoginMode
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="btn-link"
                >
                  {isLoginMode ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}