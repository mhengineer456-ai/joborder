import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const APPSCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzR4FKoU2RIxSGb9gOZhOUUEFIbfwDVPpPYdvcwEMOYQUn0glG2ccyFhfobg_hSgoFeYQ/exec";

// Mapped directly from JobOrderCredentials tab in sheet 1iBDfsxA9XEC9nhQF-ALBYlyGRZWoACYVwSnGfYYbr1
const INITIAL_CREDENTIALS = [
  { username: "Paras", password: "1125", department: "Admin", role: "admin" },
  { username: "Aman", password: "626526", department: "Sales", role: "sales" },
  { username: "Monu", password: "651", department: "Production", role: "production" },
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  });

  const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
  const [loadingCreds, setLoadingCreds] = useState(false);

  const fetchCredentials = useCallback(async () => {
    try {
      setLoadingCreds(true);
      const res = await fetch(`${APPSCRIPT_WEB_APP_URL}?action=getCredentials`).then((r) => r.json());
      if (res && res.credentials && Array.isArray(res.credentials) && res.credentials.length > 0) {
        setCredentials(res.credentials);
      }
    } catch (err) {
      console.warn("Using cached credentials sheet mapping:", err);
    } finally {
      setLoadingCreds(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("mh-user-name", user.username);
    } else {
      localStorage.removeItem("auth_user");
    }
  }, [user]);

  const login = async (username, password) => {
    let list = credentials;
    try {
      const res = await fetch(APPSCRIPT_WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "getCredentials" })
      }).then(r => r.json());
      if (res && res.credentials && Array.isArray(res.credentials) && res.credentials.length > 0) {
        list = res.credentials;
        setCredentials(list);
      }
    } catch (e) {
      // Fallback to loaded list
    }

    const normInputUser = String(username || "").trim().toLowerCase();
    const normInputPass = String(password || "").trim();

    const found = list.find(
      (u) =>
        String(u.username || "").trim().toLowerCase() === normInputUser &&
        String(u.password || "").trim() === normInputPass
    );

    if (!found) {
      throw new Error("Invalid username or password");
    }

    const role =
      found.role ||
      (String(found.department || "").toLowerCase().includes("admin")
        ? "admin"
        : String(found.department || "").toLowerCase().includes("sale")
        ? "sales"
        : String(found.department || "").toLowerCase().includes("prod")
        ? "production"
        : "viewer");

    const loggedUser = { username: found.username, department: found.department, role };
    setUser(loggedUser);
    localStorage.setItem("mh-user-name", found.username);
    return loggedUser;
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({ user, login, logout, credentials, fetchCredentials, loadingCreds }),
    [user, credentials, loadingCreds, fetchCredentials]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
