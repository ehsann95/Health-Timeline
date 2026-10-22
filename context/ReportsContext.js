"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/context/AuthContext";

const ReportsContext = createContext({
  reports: [],
  loading: true,
  isSyncing: false,
  lastSynced: null,
  allTestNames: [],
  allLabNames: [],
  allMembers: [],
  addReport: () => {},
  updateReport: () => {},
  deleteReport: async () => {},
  claimLocalReports: async () => {},
  resetToDemo: async () => {},
  syncWithServer: async () => {},
  refreshReports: async () => {},
});

function getStorageKey(user) {
  if (user && user.email) {
    const safeEmail = user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `health_timeline_reports_${safeEmail}`;
  }
  return "health_timeline_guest_reports";
}

export function ReportsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  // Keep a ref to current user to avoid race conditions during async transitions
  const currentUserRef = useRef(user);
  currentUserRef.current = user;

  // Authoritative server fetch and sync
  const syncWithServer = useCallback(async (opts = {}) => {
    const silent = opts.silent ?? false;
    if (!silent) setIsSyncing(true);

    const currentUser = currentUserRef.current;
    const targetKey = getStorageKey(currentUser);

    try {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      if (data.reports && Array.isArray(data.reports)) {
        // Verify user hasn't switched during fetch
        if (currentUserRef.current?.email === currentUser?.email) {
          setReports(data.reports);
          try {
            localStorage.setItem(targetKey, JSON.stringify(data.reports));
          } catch (e) {
            console.warn("Failed to write to localStorage:", e);
          }
          setLastSynced(new Date());
          return { ok: true, count: data.reports.length };
        }
      }
    } catch (err) {
      console.warn("Sync with server failed:", err);
      return { ok: false, error: err.message };
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  // Claim any guest reports found in localStorage and migrate them into the user account
  const claimLocalReports = useCallback(async (explicitReports = null) => {
    const currentUser = currentUserRef.current;
    if (!currentUser) return;

    let toClaim = explicitReports;
    if (!toClaim || !Array.isArray(toClaim) || toClaim.length === 0) {
      try {
        const guestJson =
          localStorage.getItem("health_timeline_guest_reports") ||
          localStorage.getItem("health_timeline_reports_v1");
        if (guestJson) {
          const parsed = JSON.parse(guestJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            toClaim = parsed;
          }
        }
      } catch (e) {
        console.warn("Could not read guest reports for claiming:", e);
      }
    }

    if (!toClaim || toClaim.length === 0) return;

    try {
      setIsSyncing(true);
      const res = await fetch("/api/reports/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: toClaim }),
      });
      const data = await res.json();

      if (data.reports && Array.isArray(data.reports)) {
        const userKey = getStorageKey(currentUser);
        setReports(data.reports);
        try {
          localStorage.setItem(userKey, JSON.stringify(data.reports));
          // Clean up legacy guest keys once successfully claimed
          localStorage.removeItem("health_timeline_guest_reports");
          localStorage.removeItem("health_timeline_reports_v1");
        } catch {}
        setLastSynced(new Date());
      }
    } catch (e) {
      console.warn("Error claiming guest reports:", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Main lifecycle: re-sync whenever user or auth loading state changes
  useEffect(() => {
    if (authLoading) return;

    let isMounted = true;
    const currentStorageKey = getStorageKey(user);

    // 1. Instant local cache restore
    try {
      const cached = localStorage.getItem(currentStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReports(parsed);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn("Could not read local cache:", e);
    }

    // 2. If logged in, claim any pending guest reports, then sync authoritative data
    async function initUserReports() {
      try {
        if (user) {
          // Check for pending guest data to claim
          const guestCached =
            localStorage.getItem("health_timeline_guest_reports") ||
            localStorage.getItem("health_timeline_reports_v1");
          if (guestCached) {
            await claimLocalReports();
          }
        }
        await syncWithServer({ silent: false });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initUserReports();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, claimLocalReports, syncWithServer]);

  // Auto-sync on window focus / visibility change (cross-device & cross-tab detection)
  useEffect(() => {
    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        syncWithServer({ silent: true });
      }
    }

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [syncWithServer]);

  // Client mutations
  const addReport = useCallback((newReport) => {
    if (!newReport) return;
    const currentStorageKey = getStorageKey(currentUserRef.current);
    setReports((prev) => {
      const filtered = prev.filter((r) => r.id !== newReport.id);
      const next = [newReport, ...filtered];
      try {
        localStorage.setItem(currentStorageKey, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist uploaded report:", e);
      }
      return next;
    });
  }, []);

  const updateReport = useCallback((updatedReport) => {
    if (!updatedReport) return;
    const currentStorageKey = getStorageKey(currentUserRef.current);
    setReports((prev) => {
      const next = prev.map((r) => (r.id === updatedReport.id ? updatedReport : r));
      try {
        localStorage.setItem(currentStorageKey, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist edited report:", e);
      }
      return next;
    });
  }, []);

  const deleteReport = useCallback(async (reportId) => {
    if (!reportId) return;
    const currentStorageKey = getStorageKey(currentUserRef.current);
    setReports((prev) => {
      const next = prev.filter((r) => r.id !== reportId);
      try {
        localStorage.setItem(currentStorageKey, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist deletion:", e);
      }
      return next;
    });

    try {
      await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Server delete call failed:", e);
    }
  }, []);

  const resetToDemo = useCallback(async () => {
    if (
      !confirm(
        "Reset to sample demo data?\n\nAll custom uploaded reports for your account will be replaced with fresh sample demo reports."
      )
    ) {
      return;
    }

    const currentStorageKey = getStorageKey(currentUserRef.current);
    setLoading(true);
    setIsSyncing(true);

    try {
      localStorage.removeItem(currentStorageKey);
      const res = await fetch("/api/reports/reset", { method: "POST" });
      const data = await res.json();

      if (data.reports && Array.isArray(data.reports)) {
        setReports(data.reports);
        try {
          localStorage.setItem(currentStorageKey, JSON.stringify(data.reports));
        } catch {}
        setLastSynced(new Date());
      } else {
        await syncWithServer();
      }
    } catch (e) {
      console.error("Failed to reset demo reports:", e);
      alert("Reset error: " + e.message);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [syncWithServer]);

  const allTestNames = useMemo(() => {
    return [...new Set(reports.flatMap((r) => (r.tests || []).map((t) => t.name)))]
      .filter(Boolean)
      .sort();
  }, [reports]);

  const allLabNames = useMemo(() => {
    return [...new Set(reports.map((r) => (r.labName || "").trim()).filter(Boolean))].sort();
  }, [reports]);

  const allMembers = useMemo(() => {
    const raw = [...new Set(reports.map((r) => (r.patientName || "Self").trim()).filter(Boolean))];
    if (!raw.includes("Self")) raw.unshift("Self");
    return raw.sort((a, b) => (a === "Self" ? -1 : b === "Self" ? 1 : a.localeCompare(b)));
  }, [reports]);

  return (
    <ReportsContext.Provider
      value={{
        reports,
        loading,
        isSyncing,
        lastSynced,
        allTestNames,
        allLabNames,
        allMembers,
        addReport,
        updateReport,
        deleteReport,
        claimLocalReports,
        resetToDemo,
        syncWithServer,
        refreshReports: syncWithServer,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  return useContext(ReportsContext);
}
