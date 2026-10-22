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

const DELETED_IDS_KEY = "health_timeline_deleted_ids";

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
  clearAllReports: async () => {},
  loadDemoReports: async () => {},
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

function getDeletedIds() {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function recordDeletedId(id) {
  try {
    const set = getDeletedIds();
    set.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn("Failed to record deleted id:", e);
  }
}

function unrecordDeletedId(id) {
  try {
    const set = getDeletedIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function ReportsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  const currentUserRef = useRef(user);
  currentUserRef.current = user;

  const currentReportsRef = useRef(reports);
  currentReportsRef.current = reports;

  // Two-way resilient server sync: re-hydrates ephemeral serverless containers
  // while NEVER destroying local browser reports if the server is cold or empty
  const syncWithServer = useCallback(async (opts = {}) => {
    const silent = opts.silent ?? false;
    if (!silent) setIsSyncing(true);

    const currentUser = currentUserRef.current;
    const targetKey = getStorageKey(currentUser);

    // Read current local state or cached storage
    let localData = currentReportsRef.current;
    if (!localData || localData.length === 0) {
      try {
        const cached = localStorage.getItem(targetKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) localData = parsed;
        }
      } catch {}
    }

    const deletedSet = getDeletedIds();
    const deletedIds = Array.from(deletedSet);

    try {
      const res = await fetch("/api/reports/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports: localData || [],
          deletedIds,
        }),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      if (data.reports && Array.isArray(data.reports)) {
        if (currentUserRef.current?.email === currentUser?.email) {
          // Filter out any explicitly deleted records
          const filtered = data.reports.filter((r) => !deletedSet.has(r.id));
          setReports(filtered);
          try {
            localStorage.setItem(targetKey, JSON.stringify(filtered));
          } catch (e) {
            console.warn("Failed to write to localStorage:", e);
          }
          setLastSynced(new Date());
          return { ok: true, count: filtered.length };
        }
      }
    } catch (err) {
      console.warn("Sync with server warning (preserving local data):", err);
      // Keep local data safe! Never overwrite with empty on error.
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

  // Main lifecycle: restore local cache immediately, then sync
  useEffect(() => {
    if (authLoading) return;

    let isMounted = true;
    const currentStorageKey = getStorageKey(user);

    // 1. Instant local cache restore
    try {
      const cached = localStorage.getItem(currentStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setReports(parsed);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn("Could not read local cache:", e);
    }

    // 2. Perform background sync with server
    async function initReports() {
      try {
        if (user) {
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

    initReports();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, claimLocalReports, syncWithServer]);

  // Auto-sync on window focus / visibility change
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
    if (!newReport || !newReport.id) return;
    unrecordDeletedId(newReport.id);
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
    if (!updatedReport || !updatedReport.id) return;
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
    recordDeletedId(reportId);
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

  // Clear all data completely (no demo data)
  const clearAllReports = useCallback(async () => {
    if (
      !confirm(
        "Clear all lab reports?\n\nThis will permanently delete all records from your timeline and account."
      )
    ) {
      return;
    }

    const currentStorageKey = getStorageKey(currentUserRef.current);
    setLoading(true);
    setIsSyncing(true);

    try {
      localStorage.removeItem(currentStorageKey);
      localStorage.removeItem(DELETED_IDS_KEY);
      setReports([]);

      await fetch("/api/reports/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      setLastSynced(new Date());
    } catch (e) {
      console.error("Failed to clear reports:", e);
      alert("Clear error: " + e.message);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Dedicated button action to load sample demo data ONLY when explicitly requested
  const loadDemoReports = useCallback(async () => {
    if (
      !confirm(
        "Load sample demo reports (CBC, LFT)?\n\nThis will add sample laboratory records so you can explore comparisons and biomarker charts."
      )
    ) {
      return;
    }

    const currentStorageKey = getStorageKey(currentUserRef.current);
    setLoading(true);
    setIsSyncing(true);

    try {
      const res = await fetch("/api/reports/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo" }),
      });
      const data = await res.json();

      if (data.reports && Array.isArray(data.reports)) {
        setReports(data.reports);
        try {
          localStorage.setItem(currentStorageKey, JSON.stringify(data.reports));
        } catch {}
        setLastSynced(new Date());
      }
    } catch (e) {
      console.error("Failed to load demo reports:", e);
      alert("Demo loading error: " + e.message);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

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
        clearAllReports,
        loadDemoReports,
        resetToDemo: clearAllReports, // alias
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
