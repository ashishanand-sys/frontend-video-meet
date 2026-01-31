import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Meeting from "./pages/Meeting";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";

function HomeContent() {
  const token = localStorage.getItem("token");

  if (!token) {
    return (
      <div
        style={{
          padding: "40px",
          fontFamily: "Arial, sans-serif",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <h1>Live Video Streaming</h1>
        <p>
          Welcome to the live streaming application. Choose an option below:
        </p>

        <div style={{ marginTop: "30px" }}>
          <Link
            to="/login"
            style={{
              display: "inline-block",
              padding: "15px 30px",
              backgroundColor: "#2196F3",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              fontSize: "16px",
              fontWeight: "bold",
              transition: "background-color 0.3s",
            }}
          >
            Login to Stream
          </Link>
        </div>
      </div>
    );
  }

  return <Home />;
}

function Navigation() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const loadUser = useCallback(() => {
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (userData && token) {
      setUser(JSON.parse(userData));
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Initial load - defer to avoid cascading renders
    const timer = setTimeout(() => loadUser(), 0);
    window.addEventListener("storage", loadUser);
    window.addEventListener("user-login", loadUser);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", loadUser);
      window.removeEventListener("user-login", loadUser);
    };
  }, [loadUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 20px",
        backgroundColor: "#333",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <Link
        to="/"
        style={{
          color: "white",
          textDecoration: "none",
          fontSize: "20px",
          fontWeight: "bold",
        }}
      >
        📹 Live Stream
      </Link>

      <div>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span>
              Welcome, <strong>{user.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 15px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/login"
              style={{
                padding: "8px 15px",
                backgroundColor: "#2196F3",
                color: "white",
                textDecoration: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Login
            </Link>
            <Link
              to="/register"
              style={{
                padding: "8px 15px",
                backgroundColor: "#4CAF50",
                color: "white",
                textDecoration: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    // Redirect to login but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<HomeContent />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/stream/:streamId"
          element={
            <ProtectedRoute>
              <Meeting />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
