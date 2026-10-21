"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const GUEST_KEY = "health_timeline_auth_mode";

const AuthContext = createContext({
  user: null,
  isGuest: true,
  loading: true,
  isGoogleConfigured: false,
  authModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  signInWithGoogle: () => {},
  signInDemo: async () => {},
  continueAsGuest: () => {},
  signOut: async () => {},
  claimReports: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Check current session on mount
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      setIsGoogleConfigured(Boolean(data.isConfigured));
      if (data.user) {
        setUser(data.user);
        setIsGuest(false);
      } else {
        setUser(null);
        const storedMode = localStorage.getItem(GUEST_KEY);
        setIsGuest(storedMode === "guest" || true);
      }
    } catch (e) {
      console.warn("Failed to check auth session:", e);
      setIsGuest(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  function continueAsGuest() {
    setIsGuest(true);
    setAuthModalOpen(false);
    try {
      localStorage.setItem(GUEST_KEY, "guest");
    } catch {}
  }

  function signInWithGoogle() {
    if (isGoogleConfigured) {
      window.location.href = "/api/auth/google";
    } else {
      // If Google credentials are not yet configured in .env, keep modal open to show Demo Sign-in
      alert(
        "Google OAuth keys are not configured in .env yet.\n\nYou can use the 'Quick Demo Sign-In' button below to test cross-device claiming right now!"
      );
    }
  }

  async function signInDemo(email = "doctor.ahsan@example.com", name = "Dr. Ahsan") {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      setUser(data.user);
      setIsGuest(false);
      setAuthModalOpen(false);
      try {
        localStorage.removeItem(GUEST_KEY);
      } catch {}

      return data.user;
    } catch (err) {
      console.error("Demo login error:", err);
      alert(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setUser(null);
      setIsGuest(true);
      try {
        localStorage.setItem(GUEST_KEY, "guest");
      } catch {}
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function claimReports(reportsToClaim) {
    if (!user || !reportsToClaim || reportsToClaim.length === 0) return null;
    try {
      const res = await fetch("/api/reports/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: reportsToClaim }),
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error("Failed to claim reports:", e);
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        loading,
        isGoogleConfigured,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        signInWithGoogle,
        signInDemo,
        continueAsGuest,
        signOut,
        claimReports,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

