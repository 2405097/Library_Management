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

  const selectedLabel = accountType === "ADMIN" ? "Admin" : "Member";

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">📚</div>
          <h2>Library Management System</h2>
          <p className="auth-subtitle">
            {isLoginMode
              ? `Sign in as ${selectedLabel}`
              : `Create a new ${selectedLabel.toLowerCase()} account`}
          </p>
        </div>

        <div className="auth-type-switch" role="tablist" aria-label="Account type">
          <button
            type="button"
            className={accountType === "MEMBER" ? "type-button active" : "type-button"}
            onClick={() => setAccountType("MEMBER")}
          >
            Member
          </button>
          <button
            type="button"
            className={accountType === "ADMIN" ? "type-button active" : "type-button"}
            onClick={() => setAccountType("ADMIN")}
          >
            Admin
          </button>
        </div>

        {errorMessage && (
          <div className="alert alert-danger" role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" role="alert">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLoginMode && (
            <>
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
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

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +1 555-0199"
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
                  placeholder="e.g. 123 Main St, Springfield"
                  autoComplete="street-address"
                  className="form-control"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. user@example.com"
              required
              autoComplete="email"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
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

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading
              ? isLoginMode
                ? "Signing in..."
                : "Creating account..."
              : isLoginMode
              ? `Sign In as ${selectedLabel}`
              : `Create ${selectedLabel} Account`}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={toggleMode}
              className="btn-link"
            >
              {isLoginMode ? "Create new account" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}