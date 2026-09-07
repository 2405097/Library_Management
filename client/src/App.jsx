import { useState } from "react";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import "./App.css";

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("library_user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    localStorage.setItem('library_user', JSON.stringify(user));
    if (token) {
      localStorage.setItem('library_token', token);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('library_token');
    if (token) {
      try {
        await fetch('/api/users/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        });
      } catch {
        // Proceed with client-side logout even if server call fails
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('library_user');
    localStorage.removeItem('library_token');
  };

  return (
    <div className="app-container">
      {currentUser ? (
        currentUser.role === "ADMIN" ? (
          <AdminDashboard user={currentUser} onLogout={handleLogout} />
        ) : (
          <Dashboard user={currentUser} onLogout={handleLogout} />
        )
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
