"use client";

import { useCallback, useEffect, useState } from "react";
import UploadPanel from "@/components/UploadPanel";
import ReportCard from "@/components/ReportCard";
import ComparePanel from "@/components/ComparePanel";

export default function Home() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({ totalReports: 0, totalTests: 0, abnormalTests: 0 });
  const [allTestNames, setAllTestNames] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState("");
  const [reportType, setReportType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState("reports"); // reports | compare

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (flag) params.set("flag", flag);
      if (reportType) params.set("reportType", reportType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (data.reports) {
        setReports(data.reports);
        setSummary(data.summary);
        const names = [...new Set(data.reports.flatMap((r) => r.tests.map((t) => t.name)))].sort();
        setAllTestNames(names);
      }
    } finally {
      setLoading(false);
    }
  }, [q, flag, reportType, from, to]);

  useEffect(() => {
    const t = setTimeout(loadReports, 300); // debounce search typing
    return () => clearTimeout(t);
  }, [loadReports]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🧪 Lab Report Manager</h1>
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

      <UploadPanel onUploaded={loadReports} />

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
          {!loading && reports.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              No reports match. Upload a report above, or adjust filters.
            </div>
          )}

          <div className="space-y-4">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onSaved={loadReports}
                onDeleted={loadReports}
              />
            ))}
          </div>
        </>
      ) : (
        <ComparePanel testNames={allTestNames} />
      )}

      <footer className="text-center text-xs text-slate-400 pt-6 pb-2">
        Prototype · All data stays in your local SQLite file · Not medical advice
      </footer>
    </main>
  );
}
