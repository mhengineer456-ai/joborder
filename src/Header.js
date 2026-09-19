import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { 
  FiShield, 
  FiLayout, 
  FiShoppingBag, 
  FiList, 
  FiEdit3, 
  FiScissors, 
  FiPrinter, 
  FiLogOut, 
  FiChevronDown, 
  FiUser,
  FiActivity
} from "react-icons/fi";

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navigationItems = [
    { path: "/dashboard", name: "Dashboard", icon: FiLayout },
    { path: "/sales-order", name: "Sales Order", icon: FiShoppingBag },
    { path: "/all-order-details", name: "All Orders", icon: FiList },
    { path: "/job-order-amendment", name: "Job Order Amendment", icon: FiEdit3 },
    { path: "/embroidery-challan", name: "Embroidery Challan", icon: FiScissors },
    { path: "/printing-challan", name: "Printing Challan", icon: FiPrinter },
  ];

  const initials = useMemo(() => {
    if (!user?.username) return "";
    const parts = String(user.username).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() || "").join("");
  }, [user]);

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
  };

  return (
    <header className="hdr" role="banner">
      <div className="hdr__inner">
        {/* Brand Header */}
        <div className="brand">
          <Link to="/dashboard" className="brand__link" aria-label="Go to Dashboard">
            <div className="brand__badge">
              <FiShield className="brand__icon" />
              <span className="brand__pulse" />
            </div>
            <div className="brand__text">
              <span className="brand__title">MH FACTORY SUITE</span>
              <span className="brand__sub">Sales & Job Work ERP</span>
            </div>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="nav" role="navigation" aria-label="Primary">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav__link ${active ? "is-active" : ""}`}
              >
                <Icon className="nav__icon" />
                <span>{item.name}</span>
                <i className="nav__indicator" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        {/* User Profile + Controls */}
        <div className="user">
          {user ? (
            <div className="profile">
              <div className="profile__wrap">
                <button
                  className="profile__btn"
                  onClick={() => setIsProfileOpen((v) => !v)}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                >
                  <span className="avatar" aria-hidden="true">{initials || "U"}</span>
                  <span className="id">
                    <span className="id__name">{user.username}</span>
                    <span className="id__role">{user.role || user.department || "User"}</span>
                  </span>
                  <FiChevronDown className={`chev ${isProfileOpen ? "open" : ""}`} />
                </button>

                {isProfileOpen && (
                  <div className="menu" role="menu">
                    <div className="menu__head">
                      <div className="avatar avatar--lg" aria-hidden="true">{initials || "U"}</div>
                      <div>
                        <div className="menu__name">{user.username}</div>
                        <div className="menu__role">{user.role || user.department || "User"}</div>
                      </div>
                    </div>
                    <div className="menu__sep" role="separator" />
                    <button className="menu__item logout" role="menuitem" onClick={handleLogout}>
                      <FiLogOut className="menu__ic" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link to="/login" className="signin">Sign In</Link>
          )}

          {/* Mobile hamburger */}
          <button
            className={`ham ${isMenuOpen ? "is-open" : ""}`}
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile drop-down */}
      {isMenuOpen && (
        <div id="mnav" className="mnav" role="navigation" aria-label="Mobile">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`mnav__link ${active ? "is-active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon className="mnav__icon" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          {!user && (
            <Link to="/login" className="mnav__link" onClick={() => setIsMenuOpen(false)}>
              <FiUser className="mnav__icon" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      )}

      <style>{`
        /* ======= HEADER STYLING ======= */
        .hdr {
          position: sticky;
          top: 0;
          z-index: 1000;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          background: rgba(9, 13, 22, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }

        .hdr__inner {
          height: 72px;
          display: flex;
          align-items: center;
          gap: 20px;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Brand Identity */
        .brand__link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .brand__badge {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
          flex-shrink: 0;
        }

        .brand__icon {
          font-size: 22px;
          color: #ffffff;
          position: relative;
          z-index: 2;
        }

        .brand__pulse {
          position: absolute;
          inset: -2px;
          border-radius: 14px;
          background: linear-gradient(135deg, #60a5fa, #2563eb);
          opacity: 0.35;
          filter: blur(6px);
        }

        .brand__text {
          display: flex;
          flex-direction: column;
        }

        .brand__title {
          font-weight: 800;
          font-size: 17px;
          letter-spacing: -0.01em;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .brand__sub {
          font-size: 11px;
          font-weight: 700;
          color: #60a5fa;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* Desktop Nav */
        .nav {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: 16px;
        }

        .nav__link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 10px;
          color: #94a3b8;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .nav__icon {
          font-size: 16px;
          transition: transform 0.2s ease;
        }

        .nav__link:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.06);
        }

        .nav__link:hover .nav__icon {
          transform: translateY(-1px);
        }

        .nav__indicator {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: -2px;
          height: 2px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          border-radius: 2px;
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.2s ease;
        }

        .nav__link.is-active {
          color: #ffffff;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }

        .nav__link.is-active .nav__indicator {
          transform: scaleX(1);
        }

        /* User Profile & Menu */
        .user {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .signin {
          padding: 8px 16px;
          border-radius: 10px;
          text-decoration: none;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          transition: all 0.2s ease;
        }

        .signin:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }

        .profile__wrap {
          position: relative;
        }

        .profile__btn {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.6);
          padding: 6px 12px;
          border-radius: 12px;
          color: #ffffff;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .profile__btn:hover {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(96, 165, 250, 0.3);
        }

        .avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }

        .avatar--lg {
          width: 42px;
          height: 42px;
          font-size: 15px;
        }

        .id {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.2;
        }

        .id__name {
          font-weight: 700;
          font-size: 13px;
          color: #f8fafc;
        }

        .id__role {
          font-size: 11px;
          font-weight: 600;
          color: #60a5fa;
          text-transform: capitalize;
        }

        .chev {
          font-size: 14px;
          color: #94a3b8;
          transition: transform 0.2s ease;
        }

        .chev.open {
          transform: rotate(180deg);
        }

        .menu {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 240px;
          background: #0f172a;
          color: #f8fafc;
          border-radius: 14px;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.12);
          overflow: hidden;
          animation: menuSlide 0.2s ease-out;
        }

        .menu__head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(30, 41, 59, 0.5);
        }

        .menu__name {
          font-weight: 700;
          font-size: 14px;
          color: #ffffff;
        }

        .menu__role {
          font-size: 12px;
          color: #60a5fa;
          font-weight: 600;
          text-transform: capitalize;
        }

        .menu__sep {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .menu__item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: transparent;
          border: 0;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          color: #fca5a5;
          transition: background 0.15s ease;
        }

        .menu__item:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .menu__ic {
          font-size: 16px;
        }

        /* Mobile Hamburger */
        .ham {
          width: 40px;
          height: 38px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.6);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          margin-left: 8px;
        }

        .ham span {
          display: block;
          width: 20px;
          height: 2px;
          background: #f8fafc;
          border-radius: 2px;
          transition: all 0.2s ease;
        }

        .ham.is-open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }

        .ham.is-open span:nth-child(2) {
          opacity: 0;
        }

        .ham.is-open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* Mobile Nav Dropdown */
        .mnav {
          display: none;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(9, 13, 22, 0.95);
          backdrop-filter: blur(12px);
          padding: 12px 16px;
        }

        .mnav__link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 10px;
          text-decoration: none;
          color: #cbd5e1;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .mnav__icon {
          font-size: 18px;
        }

        .mnav__link:hover,
        .mnav__link.is-active {
          background: rgba(37, 99, 235, 0.2);
          color: #ffffff;
        }

        @keyframes menuSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive Breakpoints */
        @media (max-width: 1100px) {
          .nav { display: none; }
          .ham { display: flex; }
          .mnav { display: block; }
          .id { display: none; }
        }

        @media (max-width: 480px) {
          .brand__sub { display: none; }
          .brand__title { font-size: 15px; }
        }
      `}</style>
    </header>
  );
}
