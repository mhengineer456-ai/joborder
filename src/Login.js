import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { FiUser, FiLock, FiArrowRight, FiEye, FiEyeOff, FiAlertCircle, FiShield } from "react-icons/fi";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await login(form.username.trim(), form.password);
      const roleLanding = {
        admin: "/dashboard",
        sales: "/sales-order",
        production: "/all-order-details",
        viewer: "/sales-data",
      }[res.role] || from;

      navigate(roleLanding, { replace: true });
    } catch (error) {
      setErr(error?.message || "Login failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card">
        {/* Header Hero Banner */}
        <header className="head">
          <div className="brand">
            <div className="brand-badge">
              <FiShield size={24} />
            </div>
            <div className="brand-text">
              <h1>MH Sales & ERP Portal</h1>
              <p>Enterprise Management Suite</p>
            </div>
          </div>
        </header>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="form" noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <div className="control">
              <FiUser className="ctrl-icon" aria-hidden="true" />
              <input
                id="username"
                autoFocus
                placeholder="Enter username (e.g. admin)"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="control">
              <FiLock className="ctrl-icon" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {err && (
            <div className="error">
              <FiAlertCircle className="error-ic" />
              <p>{err}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn">
            {loading ? (
              <span className="btn-loading">
                <span className="spin" />
                Authenticating…
              </span>
            ) : (
              <>
                Sign In to Portal <FiArrowRight className="btn-ic" />
              </>
            )}
          </button>
        </form>

        {/* Quick Role Access Hints */}
        <div className="roles-hint">
          <span className="hint-label">Quick Roles:</span>
          <div className="hint-badges">
            <span className="role-badge" onClick={() => setForm({ ...form, username: "admin" })}>Admin</span>
            <span className="role-badge" onClick={() => setForm({ ...form, username: "saleslead" })}>Sales</span>
            <span className="role-badge" onClick={() => setForm({ ...form, username: "production" })}>Production</span>
            <span className="role-badge" onClick={() => setForm({ ...form, username: "viewer" })}>Viewer</span>
          </div>
        </div>
      </div>

      <style>{`
        :root {
          --bg-canvas: radial-gradient(circle at 15% 15%, rgba(219, 234, 254, 0.8) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(224, 242, 254, 0.7) 0%, transparent 45%), #f8fafc;
          --primary-gradient: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%);
          --btn-gradient: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          --card-bg: #ffffff;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --border-color: #cbd5e1;
          --ring-color: rgba(37, 99, 235, 0.15);
          --shadow-lg: 0 20px 35px -5px rgba(37, 99, 235, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
          --radius-xl: 20px;
        }

        * { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body {
          margin: 0;
          font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
          color: var(--text-main);
        }

        .login-wrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 1.5rem;
          background: var(--bg-canvas);
        }

        .card {
          width: 100%;
          max-width: 440px;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-top: 4px solid #2563eb;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-lg);
          padding: 32px;
          animation: floatIn 0.35s ease both;
        }

        .head {
          margin-bottom: 24px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-badge {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          color: white;
          background: var(--btn-gradient);
          border-radius: 14px;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25);
        }

        .brand-text h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.2px;
        }

        .brand-text p {
          margin: 3px 0 0;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
        }

        .form {
          display: grid;
          gap: 20px;
        }

        .field label {
          display: block;
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .control {
          position: relative;
        }

        .ctrl-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 18px;
          pointer-events: none;
        }

        input {
          width: 100%;
          padding: 14px 44px;
          padding-left: 48px;
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 500;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }

        input::placeholder {
          color: #94a3b8;
        }

        input:hover {
          border-color: #94a3b8;
        }

        input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px var(--ring-color);
        }

        input:disabled {
          background: #f1f5f9;
          opacity: 0.7;
          cursor: not-allowed;
        }

        .toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: 0;
          color: #64748b;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          font-size: 18px;
          transition: all 0.2s;
        }

        .toggle:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .error {
          display: flex;
          gap: 10px;
          align-items: center;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #dc2626;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
        }

        .error-ic {
          font-size: 18px;
          flex: 0 0 auto;
        }

        .btn {
          appearance: none;
          border: 0;
          cursor: pointer;
          width: 100%;
          border-radius: 12px;
          padding: 14px 16px;
          font-weight: 700;
          font-size: 15px;
          color: white;
          background: var(--btn-gradient);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
        }

        .btn:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
          transform: translateY(-1px);
        }

        .btn:active {
          transform: translateY(0);
        }

        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .btn-ic {
          transition: transform 0.2s;
        }

        .btn:hover .btn-ic {
          transform: translateX(3px);
        }

        .btn-loading {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .spin {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          animation: spin 1s linear infinite;
        }

        .roles-hint {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hint-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .hint-badges {
          display: flex;
          gap: 6px;
        }

        .role-badge {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .role-badge:hover {
          background: #2563eb;
          color: #ffffff;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes floatIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 420px) {
          .card { padding: 24px; }
          .brand-text h1 { font-size: 18px; }
        }
      `}</style>
    </div>
  );
}
