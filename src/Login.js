import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { 
  FiUser, 
  FiLock, 
  FiArrowRight, 
  FiEye, 
  FiEyeOff, 
  FiAlertCircle, 
  FiShield, 
  FiActivity, 
  FiLayers, 
  FiCheckCircle,
  FiBriefcase,
  FiCpu,
  FiRefreshCw
} from "react-icons/fi";

export default function Login() {
  const { login, credentials, fetchCredentials, loadingCreds } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const getRoleIcon = (dept = "") => {
    const d = dept.toLowerCase();
    if (d.includes("admin")) return FiShield;
    if (d.includes("sale")) return FiBriefcase;
    if (d.includes("prod")) return FiCpu;
    return FiLayers;
  };

  const handleUserChipSelect = (u) => {
    setSelectedUser(u.username);
    setForm((prev) => ({ ...prev, username: u.username }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) {
      setErr("Please enter your username");
      return;
    }
    if (!form.password.trim()) {
      setErr("Please enter your password");
      return;
    }
    setErr("");
    setLoading(true);

    try {
      const res = await login(form.username.trim(), form.password);
      const roleLanding =
        {
          admin: "/dashboard",
          sales: "/sales-order",
          production: "/all-order-details",
          viewer: "/sales-data",
        }[res.role] || from;

      navigate(roleLanding, { replace: true });
    } catch (error) {
      setErr(error?.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Background ambient lighting orbs */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />
      <div className="glow-orb orb-3" />
      <div className="grid-overlay" />

      <div className="login-container">
        {/* Left Side: Hero Section */}
        <div className="hero-section">
          <div className="brand-header">
            <div className="brand-logo">
              <FiShield className="logo-icon" />
              <div className="logo-pulse" />
            </div>
            <div>
              <span className="brand-badge">ENTERPRISE ERP v2.4</span>
              <h1 className="brand-title">MH Factory Suite</h1>
            </div>
          </div>

          <div className="hero-tagline">
            <h2>Smart Manufacturing & Workflow Operations Platform</h2>
            <p>
              Authenticated job order processing, cutting schedules, embroidery & printing challan status with real-time audit logging.
            </p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon-wrap blue">
                <FiActivity />
              </div>
              <div>
                <h4>Real-Time Status Auditing</h4>
                <p>Track cutting, embroidery & printing status per lot number</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrap emerald">
                <FiLayers />
              </div>
              <div>
                <h4>Challan History Tracking</h4>
                <p>Cumulative per-shade delta history log management</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrap purple">
                <FiShield />
              </div>
              <div>
                <h4>Sheet Credentials Sync</h4>
                <p>Authenticated directly against JobOrderCredentials sheet</p>
              </div>
            </div>
          </div>

          <div className="system-status-pill">
            <span className="status-dot-animated" />
            <span>JobOrder Credentials Connected & Synchronized</span>
          </div>
        </div>

        {/* Right Side: Sign In Card */}
        <div className="card-section">
          <div className="login-card">
            <div className="card-header">
              <div className="welcome-tag">
                <FiCheckCircle className="check-ic" /> Portal Authentication
              </div>
              <h2>Sign In to Your Account</h2>
              <p>Select your user profile or enter credentials below</p>
            </div>

            {/* User Chips Mapped from JobOrderCredentials */}
            <div className="role-selector-wrap">
              <div className="selector-header">
                <span className="selector-title">Select Account Profile:</span>
                <button
                  type="button"
                  className="refresh-btn"
                  onClick={fetchCredentials}
                  disabled={loadingCreds}
                  title="Sync with sheet"
                >
                  <FiRefreshCw className={loadingCreds ? "spin" : ""} /> Sync Sheet
                </button>
              </div>

              <div className="role-chips">
                {credentials.map((u) => {
                  const Icon = getRoleIcon(u.department);
                  const isSelected =
                    form.username.toLowerCase() === u.username.toLowerCase() ||
                    selectedUser === u.username;
                  return (
                    <button
                      key={u.username}
                      type="button"
                      className={`role-chip ${isSelected ? "active" : ""}`}
                      onClick={() => handleUserChipSelect(u)}
                      title={`${u.username} - ${u.department}`}
                    >
                      <Icon className="chip-icon" />
                      <div className="chip-text">
                        <span className="chip-name">{u.username}</span>
                        <span className="chip-dept">{u.department}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="login-form" noValidate>
              <div className="input-group">
                <label htmlFor="username">Username</label>
                <div className="input-wrapper">
                  <FiUser className="field-icon" />
                  <input
                    id="username"
                    type="text"
                    autoFocus
                    placeholder="e.g. Paras, Aman, Monu"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <FiLock className="field-icon" />
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
                    className="password-toggle"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={loading}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="error-alert">
                  <FiAlertCircle className="error-icon" />
                  <span>{err}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? (
                  <span className="btn-loading-state">
                    <span className="spinner" />
                    Authenticating & Syncing...
                  </span>
                ) : (
                  <>
                    Sign In to Portal <FiArrowRight className="arrow-icon" />
                  </>
                )}
              </button>
            </form>

            <div className="card-footer">
              <span className="security-text">
                <FiShield /> Protected by TLS 1.3 Enterprise Encryption
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .login-root {
          min-height: 100vh;
          width: 100vw;
          overflow-x: hidden;
          background-color: #090d16;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem;
          color: #f8fafc;
        }

        /* Ambient Lighting Background */
        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 {
          width: 600px;
          height: 600px;
          top: -100px;
          left: -100px;
          background: radial-gradient(circle, #2563eb 0%, #1d4ed8 100%);
        }
        .orb-2 {
          width: 500px;
          height: 500px;
          bottom: -100px;
          right: -50px;
          background: radial-gradient(circle, #4f46e5 0%, #7c3aed 100%);
        }
        .orb-3 {
          width: 350px;
          height: 350px;
          top: 40%;
          left: 45%;
          background: radial-gradient(circle, #0284c7 0%, #0369a1 100%);
          opacity: 0.25;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }

        /* Main Container Split Layout */
        .login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1160px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 3.5rem;
          align-items: center;
        }

        /* Hero Section */
        .hero-section {
          display: flex;
          flex-direction: column;
          gap: 2.2rem;
          padding-right: 1rem;
        }

        .brand-header {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .brand-logo {
          position: relative;
          width: 62px;
          height: 62px;
          border-radius: 18px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.4);
        }

        .logo-icon {
          font-size: 30px;
          color: #ffffff;
          position: relative;
          z-index: 2;
        }

        .logo-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 22px;
          background: linear-gradient(135deg, #60a5fa, #2563eb);
          opacity: 0.4;
          filter: blur(8px);
          animation: pulseGlow 3s ease-in-out infinite alternate;
        }

        .brand-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #60a5fa;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(96, 165, 250, 0.3);
          padding: 4px 10px;
          border-radius: 20px;
          margin-bottom: 4px;
        }

        .brand-title {
          margin: 0;
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .hero-tagline h2 {
          margin: 0 0 0.75rem 0;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.35;
          color: #f1f5f9;
        }

        .hero-tagline p {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: #94a3b8;
          max-width: 520px;
        }

        .feature-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .feature-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          transition: all 0.25s ease;
        }

        .feature-card:hover {
          background: rgba(30, 41, 59, 0.7);
          border-color: rgba(96, 165, 250, 0.3);
          transform: translateX(4px);
        }

        .feature-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }
        .feature-icon-wrap.blue {
          background: rgba(37, 99, 235, 0.2);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .feature-icon-wrap.emerald {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .feature-icon-wrap.purple {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .feature-card h4 {
          margin: 0 0 2px 0;
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
        }
        .feature-card p {
          margin: 0;
          font-size: 13px;
          color: #94a3b8;
        }

        .system-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          color: #34d399;
          width: fit-content;
        }

        .status-dot-animated {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #10b981;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: statusPulse 2s infinite;
        }

        /* Right Card Section */
        .card-section {
          display: flex;
          justify-content: center;
        }

        .login-card {
          width: 100%;
          max-width: 450px;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 2.25rem 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          animation: floatInCard 0.4s ease-out both;
        }

        .card-header {
          margin-bottom: 1.25rem;
        }

        .welcome-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #60a5fa;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .check-ic {
          font-size: 14px;
        }

        .card-header h2 {
          margin: 0 0 6px 0;
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
        }

        .card-header p {
          margin: 0;
          font-size: 14px;
          color: #94a3b8;
        }

        /* Role Selector Chips */
        .role-selector-wrap {
          margin-bottom: 1.25rem;
        }

        .selector-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .selector-title {
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .refresh-btn {
          background: none;
          border: none;
          color: #60a5fa;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover {
          background: rgba(59, 130, 246, 0.15);
        }

        .role-chips {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .role-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .role-chip:hover {
          background: rgba(51, 65, 85, 0.8);
          border-color: rgba(96, 165, 250, 0.4);
          color: #ffffff;
        }

        .role-chip.active {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.3) 0%, rgba(29, 78, 216, 0.4) 100%);
          border-color: #3b82f6;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
        }

        .chip-icon {
          font-size: 16px;
          color: #60a5fa;
          flex-shrink: 0;
        }

        .chip-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .chip-name {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chip-dept {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Login Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }

        .input-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #cbd5e1;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          left: 14px;
          font-size: 18px;
          color: #64748b;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .input-wrapper input {
          width: 100%;
          padding: 13px 14px 13px 44px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #ffffff;
          font-size: 15px;
          font-weight: 500;
          outline: none;
          transition: all 0.2s ease;
        }

        .input-wrapper input::placeholder {
          color: #64748b;
        }

        .input-wrapper input:hover {
          border-color: rgba(255, 255, 255, 0.25);
        }

        .input-wrapper input:focus {
          border-color: #3b82f6;
          background: rgba(15, 23, 42, 0.95);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
        }

        .input-wrapper input:focus ~ .field-icon,
        .input-wrapper:focus-within .field-icon {
          color: #60a5fa;
        }

        .password-toggle {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          color: #64748b;
          padding: 6px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s ease;
        }

        .password-toggle:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.08);
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
          font-weight: 600;
          animation: shake 0.3s ease;
        }

        .error-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .submit-btn {
          margin-top: 0.5rem;
          width: 100%;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5);
          transition: all 0.25s ease;
        }

        .submit-btn:hover {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow: 0 14px 30px -5px rgba(37, 99, 235, 0.6);
          transform: translateY(-1px);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .arrow-icon {
          font-size: 18px;
          transition: transform 0.2s ease;
        }

        .submit-btn:hover .arrow-icon {
          transform: translateX(4px);
        }

        .btn-loading-state {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        .card-footer {
          margin-top: 1.5rem;
          padding-top: 1.15rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
        }

        .security-text {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        /* Keyframes */
        @keyframes pulseGlow {
          0% { opacity: 0.3; transform: scale(0.98); }
          100% { opacity: 0.6; transform: scale(1.05); }
        }

        @keyframes statusPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes floatInCard {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }

        /* Responsive Breakpoints */
        @media (max-width: 960px) {
          .login-container {
            grid-template-columns: 1fr;
            gap: 2.5rem;
          }
          .hero-section {
            padding-right: 0;
            text-align: center;
            align-items: center;
          }
          .brand-header {
            justify-content: center;
          }
          .hero-tagline p {
            max-width: 100%;
          }
          .feature-grid {
            width: 100%;
            max-width: 500px;
          }
        }

        @media (max-width: 480px) {
          .login-root {
            padding: 1rem;
          }
          .login-card {
            padding: 1.75rem 1.25rem;
            border-radius: 20px;
          }
          .brand-title {
            font-size: 26px;
          }
          .hero-tagline h2 {
            font-size: 20px;
          }
          .role-chips {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
