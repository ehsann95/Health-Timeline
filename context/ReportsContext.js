"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const STORAGE_KEY = "health_timeline_reports_v1";

const ReportsContext = createContext({
  reports: [],
  loading: true,
  allTestNames: [],
  allLabNames: [],
  allMembers: [],
  addReport: () => {},
  updateReport: () => {},
  deleteReport: () => {},
  claimLocalReports: async () => {},
  resetToDemo: async () => {},
  refreshReports: async () => {},
});

export function ReportsProvider({ children }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load initial reports from localStorage or fallback to /api/reports
  const loadReports = useCallback(async () => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReports(parsed);
          setLoading(false);
          // Background sync with API
          fetch("/api/reports")
            .then((res) => res.json())
            .then((data) => {
              if (data.reports && Array.isArray(data.reports)) {
                setReports((prev) => {
                  const map = new Map(data.reports.map((r) => [r.id, r]));
                  for (const r of prev) {
                    if (!map.has(r.id)) map.set(r.id, r);
                  }
                  const merged = Array.from(map.values());
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                  } catch {}
                  return merged;
                });
              }
            })
            .catch(() => {});
          return;
        }
      }
    } catch (e) {
      console.warn("Could not read from localStorage:", e);
    }

    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (data.reports && Array.isArray(data.reports)) {
        setReports(data.reports);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.reports));
        } catch {}
      }
    } catch (err) {
      console.error("Failed to load initial reports:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const addReport = useCallback((newReport) => {
    if (!newReport) return;
    setReports((prev) => {
      const filtered = prev.filter((r) => r.id !== newReport.id);
      const next = [newReport, ...filtered];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist uploaded report:", e);
      }
      return next;
    });
  }, []);

  const updateReport = useCallback((updatedReport) => {
    if (!updatedReport) return;
    setReports((prev) => {
      const next = prev.map((r) => (r.id === updatedReport.id ? updatedReport : r));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist edited report:", e);
      }
      return next;
    });
  }, []);

  const deleteReport = useCallback((reportId) => {
    if (!reportId) return;
    setReports((prev) => {
      const next = prev.filter((r) => r.id !== reportId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist deletion:", e);
      }
      return next;
    });
  }, []);

  // Claim any local guest reports and bind them to the logged-in user on the server
  const claimLocalReports = useCallback(async () => {
    if (reports.length === 0) return;
    try {
      const res = await fetch("/api/reports/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports }),
      });
      const data = await res.json();
      if (data.reports && Array.isArray(data.reports)) {
        setReports(data.reports);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.reports));
      }
    } catch (e) {
      console.warn("Claim local reports failed:", e);
    }
  }, [reports]);

  const resetToDemo = useCallback(async () => {
    if (!confirm("Reset to sample demo data? All custom uploaded reports will be replaced with initial sample data.")) return;
    setLoading(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
      const res = await fetch("/api/reports/reset", { method: "POST" });
      const data = await res.json();
      if (data.reports && Array.isArray(data.reports)) {
        setReports(data.reports);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.reports));
        } catch {}
      } else {
        // Fallback fetch
        const fallbackRes = await fetch("/api/reports");
        const fallbackData = await fallbackRes.json();
        if (fallbackData.reports) setReports(fallbackData.reports);
      }
    } catch (e) {
      console.error("Failed to reset demo reports:", e);
      alert("Reset error: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const allTestNames = useMemo(() => {
    return [...new Set(reports.flatMap((r) => (r.tests || []).map((t) => t.name)))].filter(Boolean).sort();
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
        allTestNames,
        allLabNames,
        allMembers,
        addReport,
        updateReport,
        deleteReport,
        claimLocalReports,
        resetToDemo,
        refreshReports: loadReports,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  return useContext(ReportsContext);
}
