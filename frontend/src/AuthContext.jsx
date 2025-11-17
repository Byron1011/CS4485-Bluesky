import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        (async () => {
        try {
            const res = await fetch("/me", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!ignore) setUser(data?.user ?? null);
        } catch {
            if (!ignore) setUser(null);
        } finally {
            if (!ignore) setLoading(false);
        }
        })();
        return () => { ignore = true; };
    }, []);

    async function register(username, password) {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password, role: "user" })
        });
        if (!res.ok) {
    let message = "Registration failed";

    try {
      const data = await res.json();
      if (data?.error) {
        message = data.error;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }

    if (typeof message === "string" &&
        /E11000.*duplicate key error/i.test(message)) {
      message = "Username already taken. Please pick a different one.";
    }

    throw new Error(message);
  }
    }

    async function login(username, password) {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error("Invalid username or password");

        // After login, ask /me to get username/role from the cookie
        const me = await fetch("/me", { credentials: "include" }).then(r => r.json()).catch(() => ({}));
        setUser(me?.user ?? { username, role: "user" });
    }

    async function logout() {
        await fetch("/logout", { method: "GET", credentials: "include" }).catch(() => {});
        setUser(null);
    }

    const value = useMemo(
                    () => ({ user, loading, login, logout, register }),
                    [user, loading]
    );
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}
