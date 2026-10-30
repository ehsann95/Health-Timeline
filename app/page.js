"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ReportCard from "@/components/ReportCard";
import DoctorSummaryModal from "@/components/DoctorSummaryModal";
import { useReports } from "@/context/ReportsContext";

function applyFilters(reports, { q, flag, reportType, lab, patient, from, to }) {
  let filtered = reports;

  if (patient) {
    const patNeedle = patient.toLowerCase();
    filtered = filtered.filter((r) =>
      (r.patientName || "Self").toLowerCase() === patNeedle
    );
  }

  if (lab) {
    const labNeedle = lab.toLowerCase();
    filtered = filtered.filter((r) =>
      (r.labName || "").toLowerCase().includes(labNeedle)
    );
  }

  if (reportType) {
    const needle = reportType.toLowerCase();
    filtered = filtered.filter((r) =>
      (r.reportType || "").toLowerCase().includes(needle) ||
      (r.tests || []).some((t) => (t.category || "").toLowerCase() === needle)
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
  const { reports, loading, allLabNames, allMembers, updateReport, deleteReport, loadDemoReports } = useReports();

  // Filters state
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState("");
  const [reportType, setReportType] = useState("");
  const [lab, setLab] = useState("");
  const [patient, setPatient] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [doctorSummaryOpen, setDoctorSummaryOpen] = useState(false);

  const hasActiveFilters = Boolean(q || flag || reportType || lab || patient || from || to);

  function clearFilters() {
    setQ("");
    setFlag("");
    setReportType("");
    setLab("");
    setPatient("");
    setFrom("");
    setTo("");
  }

  // Filtered reports
  const displayedReports = useMemo(() => {
    return applyFilters(reports, { q, flag, reportType, lab, patient, from, to });
  }, [reports, q, flag, reportType, lab, patient, from, to]);

  // Overall summary stats
  const summary = useMemo(() => {
    return {
      totalReports: reports.length,
      totalTests: reports.reduce((n, r) => n + (r.tests?.length || 0), 0),
      abnormalTests: reports.reduce(
        (n, r) => n + (r.tests?.filter((t) => t.flag !== "NORMAL").length || 0),
        0
      ),
      totalLabs: allLabNames.length,
    };
  }, [reports, allLabNames]);

  return (
    <div className="space-y-6">
      {/* Dashboard content (hidden when printing doctor summary) */}
      <div className={doctorSummaryOpen ? "print-hide-for-summary" : ""}>
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lab Reports Timeline</h1>
          <p className="text-sm text-slate-500">
            Review, filter, and track biomarkers across all your lab visits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setDoctorSummaryOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors shadow-xs"
            title="Generate a multi-page clinical briefing for your doctor consultation"
          >
            <span>🩺</span>
            <span>Doctor Summary</span>
          </button>
          <Link
            href="/upload"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors shadow-xs"
          >
            <span>+ Upload</span>
          </Link>
          <Link
            href="/compare"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors shadow-xs"
          >
            <span>📈 Compare</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Reports", value: summary.totalReports, icon: "📋", cls: "text-slate-900" },
          { label: "Biomarker Tests", value: summary.totalTests, icon: "🔬", cls: "text-slate-900" },
          {
            label: "Out of Range",
            value: summary.abnormalTests,
            icon: "⚠️",
            cls: summary.abnormalTests > 0 ? "text-red-600 font-bold" : "text-green-600",
          },
          { label: "Labs Tracked", value: summary.totalLabs, icon: "🏥", cls: "text-slate-900" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.cls}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tests, notes…"
              className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>

          {/* Family Member Filter */}
          <select
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Family ({allMembers.length})</option>
            {allMembers.map((name) => (
              <option key={name} value={name}>
                👤 {name}
              </option>
            ))}
          </select>

          {/* Lab Filter */}
          <select
            value={lab}
            onChange={(e) => setLab(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Labs ({allLabNames.length})</option>
            {allLabNames.map((name) => (
              <option key={name} value={name}>
                🏥 {name}
              </option>
            ))}
          </select>

          {/* Panel / Category Filter */}
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Panels</option>
            <option value="CBC">🩸 Complete Blood Count (CBC)</option>
            <option value="LFT">🧪 Liver Function (LFT)</option>
            <option value="KFT">🫘 Kidney Function (KFT)</option>
            <option value="Lipid">🫀 Lipid Profile</option>
            <option value="Thyroid">🦋 Thyroid Profile</option>
            <option value="Blood Sugar">🍬 Blood Sugar / Glucose</option>
            <option value="Vitamins">💊 Vitamins</option>
            <option value="Other">📋 Other</option>
          </select>

          {/* Flag / Abnormal Filter */}
          <select
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Test Values</option>
            <option value="ABNORMAL">⚠️ Out of Range Only</option>
            <option value="HIGH">🔴 High Only</option>
            <option value="LOW">🔵 Low Only</option>
            <option value="NORMAL">🟢 Normal Only</option>
          </select>
        </div>

        {/* Date Range & Clear Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-medium text-slate-500">Date Range:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-xs"
              placeholder="From"
            />
            <span>to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-xs"
              placeholder="To"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Showing <span className="font-semibold text-slate-800">{displayedReports.length}</span> of{" "}
              {reports.length} reports
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center space-y-4">
          <div className="text-4xl">📄</div>
          <h3 className="text-lg font-bold text-slate-800">No lab reports found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You haven&apos;t uploaded any laboratory test reports yet. Upload a PDF or photo of your lab report to extract and track biomarkers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <span>+ Upload Your First Report</span>
            </Link>
            <button
              onClick={loadDemoReports}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-slate-200"
              title="Populate 3 sample reports (CBC, LFT) to preview features"
            >
              <span>🧪 Load Sample Demo Data</span>
            </button>
          </div>
        </div>
      ) : displayedReports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center space-y-3">
          <div className="text-3xl">🔍</div>
          <h3 className="text-base font-semibold text-slate-800">No reports match your filters</h3>
          <p className="text-sm text-slate-500">
            Try adjusting your search keywords, clearing panel or lab selections, or resetting the date range.
          </p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedReports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onSaved={updateReport}
              onDeleted={deleteReport}
            />
          ))}
        </div>
      )}
      </div>{/* end print-hide-for-summary wrapper */}

      {/* Doctor Consultation Briefing Modal */}
      <DoctorSummaryModal
        isOpen={doctorSummaryOpen}
        onClose={() => setDoctorSummaryOpen(false)}
      />
    </div>
  );
}
