"use client";

import { useEffect, useMemo, useState } from "react";
import UploadPanel from "@/components/UploadPanel";
import ReportCard from "@/components/ReportCard";
import ComparePanel from "@/components/ComparePanel";

const STORAGE_KEY = "health_timeline_reports_v1";

function applyFilters(reports, { q, flag, reportType, from, to }) {
  let filtered = reports;

  if (reportType) {
    const needle = reportType.toLowerCase();
    filtered = filtered.filter((r) =>
      (r.reportType || "").toLowerCase().includes(needle)
    );
  }

  if (from) {
    const fromDate = new Date(from);
    filtered = filtered.filter(
      (r) => r.reportDate && new Date(r.reportDate) >= fromDate
    );
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter(
      (r) => r.reportDate && new Date(r.reportDate) <= toDate
    );
  }

  if (q || flag) {
    filtered = filtered
      .map((r) => {
        let tests = r.tests || [];
        if (flag === "ABNORMAL") tests = tests.filter((t) => t.flag !== "NORMAL");
        else if (flag) tests = tests.filter((t) => t.flag === flag);

        if (q) {
          const needle = q.toLowerCase();
          tests = tests.filter(
            (t) =>
              (t.name || "").toLowerCase().includes(needle) ||
              (r.reportType || "").toLowerCase().includes(needle) ||
              (r.labName || "").toLowerCase().includes(needle)
          );
        }
        return { ...r, tests };
      })
      .filter(
        (r) =>
          r.tests.length > 0 ||
          (!q && !flag) ||
          (r.rawText && r.rawText.toLowerCase().includes(q.toLowerCase()))
      );
  }

  return filtered;
}

export default function Home() {
  const [rawReports, setRawReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState("");
  const [reportType, setReportType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState("reports"); // reports | compare

  // Initialize reports from localStorage or API on first visit
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRawReports(parsed);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not read from localStorage:", e);
    }

    // Initial load from server
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data) => {
        if (data.reports && Array.isArray(data.reports)) {
          setRawReports(data.reports);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.reports));
          } catch {}
        }
      })
      .catch((err) => console.error("Failed to load initial reports:", err))
      .finally(() => setLoading(false));
  }, []);

  function persistReports(newList) {
    setRawReports(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  }

  function handleUploaded(newReport) {
    if (!newReport) return;
    setRawReports((prev) => {
      const filtered = prev.filter((r) => r.id !== newReport.id);
      const next = [newReport, ...filtered];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist uploaded report:", e);
      }
      return next;
    });
  }

  function handleSaved(updatedReport) {
    if (!updatedReport) return;
    setRawReports((prev) => {
      const next = prev.map((r) => (r.id === updatedReport.id ? updatedReport : r));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist edited report:", e);
      }
      return next;
    });
  }

  function handleDeleted(reportId) {
    if (!reportId) return;
    setRawReports((prev) => {
      const next = prev.filter((r) => r.id !== reportId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist deletion:", e);
      }
      return next;
    });
  }

  async function handleResetToDemo() {
    if (!confirm("Reset to sample demo data? Any custom uploaded reports will be replaced.")) return;
    setLoading(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (data.reports && Array.isArray(data.reports)) {
        persistReports(data.reports);
      }
    } catch (err) {
      console.error("Failed to reset demo reports:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filtered reports for view
  const displayedReports = useMemo(() => {
    return applyFilters(rawReports, { q, flag, reportType, from, to });
  }, [rawReports, q, flag, reportType, from, to]);

  // Overall summary stats
  const summary = useMemo(() => {
    return {
      totalReports: displayedReports.length,
      totalTests: displayedReports.reduce((n, r) => n + (r.tests?.length || 0), 0),
      abnormalTests: displayedReports.reduce(
        (n, r) => n + (r.tests?.filter((t) => t.flag !== "NORMAL").length || 0),
        0
      ),
    };
  }, [displayedReports]);

  // Distinct test names for Compare panel across all loaded reports
  const allTestNames = useMemo(() => {
    return [...new Set(rawReports.flatMap((r) => (r.tests || []).map((t) => t.name)))].sort();
  }, [rawReports]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🧪 Health Timeline</h1>
          <p className="text-sm text-slate-500">Store, understand and compare your lab reports — private &amp; local.</p>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
          <button onClick={() => setView("reports")} className={`px-4 py-2 ${view === "reports" ? "bg-blue-600 text-white" : "bg-white hover:bg-slate-50"}`}>Reports</button>
          <button onClick={() => setView("compare")} className={`px-4 py-2 ${view === "compare" ? "bg-blue-600 text-white" : "bg-white hover:bg-slate-50"}`}>Compare</button>
        </div>
      </header>

      {/* Dashboard stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Reports", value: summary.totalReports, cls: "text-slate-900" },
          { label: "Test values", value: summary.totalTests, cls: "text-slate-900" },
          { label: "Out of range", value: summary.abnormalTests, cls: summary.abnormalTests > 0 ? "text-red-600" : "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow p-4 text-center">
            <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <UploadPanel onUploaded={handleUploaded} />

      {view === "reports" ? (
        <>
          {/* Search & filters */}
          <div className="bg-white rounded-xl shadow p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 Search test name, type, lab…"
              className="border rounded-md px-3 py-2 text-sm lg:col-span-2"
            />
            <select value={flag} onChange={(e) => setFlag(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              <option value="">All values</option>
              <option value="ABNORMAL">⚠️ Only abnormal</option>
              <option value="HIGH">▲ Only above range</option>
              <option value="LOW">▼ Only below range</option>
              <option value="NORMAL">✓ Only normal</option>
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-md px-3 py-2 text-sm" title="From date" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-md px-3 py-2 text-sm" title="To date" />
          </div>

          {loading && <p className="text-sm text-slate-500 text-center py-4">Loading reports…</p>}
          {!loading && displayedReports.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              No reports match. Upload a report above, or adjust filters.
            </div>
          )}

          <div className="space-y-4">
            {displayedReports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </>
      ) : (
        <ComparePanel testNames={allTestNames} reports={rawReports} />
      )}

      <footer className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-6 pb-2">
        <span>Prototype · All data stays in your local storage · Not medical advice</span>
        <button
          onClick={handleResetToDemo}
          className="text-slate-500 hover:text-slate-700 underline"
        >
          Reset to sample demo
        </button>
      </footer>
    </main>
  );
}
