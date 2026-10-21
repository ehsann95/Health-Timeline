"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const STORAGE_KEY = "health_timeline_reports_v1";

const ReportsContext = createContext({
  reports: [],
  loading: true,
  allTestNames: [],
  allLabNames: [],
  addReport: () => {},
  updateReport: () => {},
  deleteReport: () => {},
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

  const resetToDemo = useCallback(async () => {
    if (!confirm("Reset to sample demo data? Any custom uploaded reports will be replaced.")) return;
    setLoading(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (data.reports && Array.isArray(data.reports)) {
        setReports(data.reports);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.reports));
        } catch {}
      }
    } catch (e) {
      console.error("Failed to reset demo reports:", e);
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

  return (
    <ReportsContext.Provider
      value={{
        reports,
        loading,
        allTestNames,
        allLabNames,
        addReport,
        updateReport,
        deleteReport,
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

