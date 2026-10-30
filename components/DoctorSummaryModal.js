"use client";

import { useMemo, useState } from "react";
import { useReports } from "@/context/ReportsContext";

const MAX_READINGS = 5; // Show up to 5 most recent values

const CATEGORY_ICONS = {
  CBC: "🩸",
  LFT: "🧪",
  KFT: "🫘",
  Lipid: "🫀",
  Thyroid: "🦋",
  "Blood Sugar": "🍬",
  Vitamins: "💊",
  Iron: "🧲",
  Cardiac: "❤️",
  Inflammation: "🔥",
  Biochemistry: "🔬",
  Other: "📋",
};

export default function DoctorSummaryModal({ isOpen, onClose }) {
  const { reports, allMembers } = useReports();
  const [selectedMember, setSelectedMember] = useState("All");

  // Filter reports by selected family member
  const memberReports = useMemo(() => {
    if (selectedMember === "All") return reports;
    return reports.filter((r) => (r.patientName || "Self").toLowerCase() === selectedMember.toLowerCase());
  }, [reports, selectedMember]);

  // Compute complete test histories for this member
  const { abnormalTests, testTrajectories, recentLabs, reportDates } = useMemo(() => {
    const sorted = [...memberReports].sort(
      (a, b) => new Date(b.reportDate || b.createdAt) - new Date(a.reportDate || a.createdAt)
    );

    const testMap = new Map();
    const abnormalList = [];

    for (const r of sorted) {
      for (const t of r.tests || []) {
        if (!testMap.has(t.name)) {
          testMap.set(t.name, {
            name: t.name,
            category: t.category || "Other",
            unit: t.unit,
            refLow: t.refLow,
            refHigh: t.refHigh,
            readings: [],
          });
        }
        const item = testMap.get(t.name);
        item.readings.push({
          value: t.value,
          flag: t.flag,
          date: r.reportDate || r.createdAt,
          labName: r.labName,
        });

        if (t.flag !== "NORMAL") {
          abnormalList.push({
            name: t.name,
            category: t.category || "Other",
            value: t.value,
            unit: t.unit,
            flag: t.flag,
            refLow: t.refLow,
            refHigh: t.refHigh,
            date: r.reportDate,
            labName: r.labName,
          });
        }
      }
    }

    // Build trajectories with up to MAX_READINGS recent values
    const trajectories = Array.from(testMap.values()).map((item) => {
      const recentReadings = item.readings.slice(0, MAX_READINGS);
      const latest = recentReadings[0];
      const previous = recentReadings[1] || null;
      let trend = "STABLE";
      if (previous && latest.value !== previous.value) {
        trend = latest.value > previous.value ? "INCREASING" : "DECREASING";
      }
      return {
        ...item,
        recentReadings,
        latest,
        previous,
        trend,
      };
    });

    // Collect unique report dates (newest first) for column headers
    const uniqueDates = [];
    const seenDates = new Set();
    for (const r of sorted) {
      const d = r.reportDate || r.createdAt;
      const key = new Date(d).toISOString().slice(0, 10);
      if (!seenDates.has(key)) {
        seenDates.add(key);
        uniqueDates.push(d);
      }
    }

    const recentLabsList = sorted.map((r) => ({
      date: r.reportDate,
      labName: r.labName || "Diagnostic Lab",
      type: r.reportType,
      count: r.tests?.length || 0,
    }));

    return {
      abnormalTests: abnormalList,
      testTrajectories: trajectories,
      reportDates: uniqueDates.slice(0, MAX_READINGS),
      recentLabs: recentLabsList,
    };
  }, [memberReports]);

  if (!isOpen) return null;

  function handlePrint() {
    window.print();
  }

  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  function formatShortDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  }

  // Group trajectories by category for structured display
  const categorizedTrajectories = {};
  for (const item of testTrajectories) {
    const cat = item.category || "Other";
    if (!categorizedTrajectories[cat]) categorizedTrajectories[cat] = [];
    categorizedTrajectories[cat].push(item);
  }

  // Determine how many date columns to show (at least 1, up to MAX_READINGS)
  const numDateCols = Math.max(1, reportDates.length);

  return (
    <div className="doctor-summary-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="doctor-summary-modal-content bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full my-auto overflow-hidden">
          {/* Top Control Bar (Hidden when printing) */}
          <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xl">🩺</span>
              <div>
                <span className="font-semibold text-sm sm:text-base">Doctor Consultation Briefing</span>
                <span className="text-xs text-slate-400 block sm:inline sm:ml-2">
                  (Multi-page PDF ready)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <span>🖨️</span>
                <span>Print / Save Multi-page PDF</span>
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-sm font-bold p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Clinical Document Content (Multi-Page Flow) */}
          <div className="p-5 sm:p-8 space-y-6 text-slate-800 font-sans print:p-0 print:space-y-5">
            {/* Clinical Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-end justify-between gap-4 print-avoid-break">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-blue-600">
                  Comprehensive Medical Laboratory Summary
                </p>
                <h1 className="text-2xl font-bold text-slate-900">Clinical Diagnostic Briefing</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prepared for treating physician · Report Date: {todayFormatted}
                </p>
              </div>

              {/* Profile Selector (Screen only) */}
              <div className="print:hidden">
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  Filter Patient Profile:
                </label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white shadow-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Family Profiles</option>
                  {allMembers.map((m) => (
                    <option key={m} value={m}>
                      👤 {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Print-only patient header */}
              <div className="hidden print:block text-right text-xs">
                <p className="font-bold text-sm text-slate-900">
                  Patient: {selectedMember === "All" ? "Family Records" : selectedMember}
                </p>
                <p className="text-slate-500">Generated: {todayFormatted}</p>
              </div>
            </div>

            {/* Demographic & Record Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs print:bg-white print:border-slate-300 print-avoid-break">
              <div>
                <span className="text-slate-500 block">Patient Name</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedMember === "All" ? "All Profiles" : selectedMember}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Reports Analyzed</span>
                <span className="font-bold text-slate-900 text-sm">{memberReports.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Biomarkers Tracked</span>
                <span className="font-bold text-slate-900 text-sm">{testTrajectories.length} tests</span>
              </div>
              <div>
                <span className="text-slate-500 block">Out-of-Range Markers</span>
                <span
                  className={`font-bold text-sm ${
                    abnormalTests.length > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {abnormalTests.length} flagged
                </span>
              </div>
            </div>

            {/* Critical Abnormal Findings Box */}
            <div className="print-avoid-break">
              {abnormalTests.length > 0 ? (
                <div className="border border-red-300 bg-red-50/70 rounded-xl p-4 space-y-2.5 print:border-red-400">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Out-of-Range / Abnormal Clinical Findings ({abnormalTests.length} readings)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {abnormalTests.map((t, i) => (
                      <div
                        key={i}
                        className="bg-white p-2.5 rounded-lg border border-red-200 flex items-center justify-between shadow-xs print-avoid-break"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">{t.name}</span>
                            {t.category && t.category !== "Other" && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                {t.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">
                            Ref: {t.refLow ?? "?"} – {t.refHigh ?? "?"} {t.unit || ""}
                            {t.date && (
                              <span className="ml-1 text-slate-400">· {formatShortDate(t.date)}</span>
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm text-red-700 block">
                            {t.value} {t.unit}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-red-600">
                            {t.flag === "HIGH" ? "▲ HIGH" : "▼ LOW"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-center gap-2">
                  <span>✅</span>
                  <span>All recorded biomarker tests fall within normal laboratory reference ranges.</span>
                </div>
              )}
            </div>

            {/* Biomarker History Table — Recent 5 Values per Category */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Biomarker History · Last {numDateCols} Reading{numDateCols !== 1 ? "s" : ""} per Marker ({testTrajectories.length} tests)
                </h3>
                <span className="text-[11px] text-slate-400 print:hidden">
                  Grouped by clinical panel
                </span>
              </div>

              {Object.entries(categorizedTrajectories).map(([category, items]) => (
                <div key={category} className="print-avoid-break">
                  {/* Category Header */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{CATEGORY_ICONS[category] || "📋"}</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {category} Panel ({items.length} tests)
                    </h4>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300 mb-4">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold print-table-header">
                        <tr>
                          <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Biomarker</th>
                          <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Ref Range</th>
                          {reportDates.slice(0, MAX_READINGS).map((d, i) => (
                            <th key={i} className="py-2 px-2 sm:px-3 text-center whitespace-nowrap">
                              <div className="text-[10px] text-slate-500 font-normal">{formatShortDate(d)}</div>
                              {i === 0 && <div className="text-[9px] text-blue-600 font-bold">LATEST</div>}
                            </th>
                          ))}
                          <th className="py-2 px-2 sm:px-3 text-center whitespace-nowrap">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item) => {
                          const isAbnormal = item.latest?.flag !== "NORMAL";
                          return (
                            <tr
                              key={item.name}
                              className={`print-row-avoid ${
                                isAbnormal ? "bg-red-50/40" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="py-1.5 px-2 sm:px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {item.name}
                              </td>
                              <td className="py-1.5 px-2 sm:px-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                                {item.refLow != null && item.refHigh != null
                                  ? `${item.refLow}–${item.refHigh}`
                                  : item.refHigh != null
                                  ? `< ${item.refHigh}`
                                  : "—"}
                                {item.unit ? ` ${item.unit}` : ""}
                              </td>
                              {/* Render value cells aligned to the report date columns */}
                              {reportDates.slice(0, MAX_READINGS).map((colDate, colIdx) => {
                                const colKey = new Date(colDate).toISOString().slice(0, 10);
                                // Find a reading for this test on this date
                                const reading = item.recentReadings.find(
                                  (r) => new Date(r.date).toISOString().slice(0, 10) === colKey
                                );
                                if (!reading) {
                                  return (
                                    <td key={colIdx} className="py-1.5 px-2 sm:px-3 text-center text-slate-300">
                                      —
                                    </td>
                                  );
                                }
                                const flagCls =
                                  reading.flag === "HIGH"
                                    ? "text-red-700 font-bold"
                                    : reading.flag === "LOW"
                                    ? "text-blue-700 font-bold"
                                    : "text-slate-900";
                                return (
                                  <td key={colIdx} className={`py-1.5 px-2 sm:px-3 text-center ${flagCls}`}>
                                    <span className="font-semibold">{reading.value}</span>
                                    {reading.flag !== "NORMAL" && (
                                      <span className="ml-0.5 text-[9px]">
                                        {reading.flag === "HIGH" ? "▲" : "▼"}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-1.5 px-2 sm:px-3 text-center">
                                {item.recentReadings.length > 1 ? (
                                  <span
                                    className={`inline-block text-[10px] font-bold ${
                                      item.trend === "INCREASING"
                                        ? "text-red-600"
                                        : item.trend === "DECREASING"
                                        ? "text-blue-600"
                                        : "text-green-600"
                                    }`}
                                  >
                                    {item.trend === "INCREASING"
                                      ? "↑ Rising"
                                      : item.trend === "DECREASING"
                                      ? "↓ Falling"
                                      : "→ Stable"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* All Laboratory Sources & Dates */}
            <div className="space-y-2 print-avoid-break">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Diagnostic Laboratory Records Included ({recentLabs.length} reports)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {recentLabs.map((l, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700"
                  >
                    <p className="font-semibold text-slate-900 truncate">🏥 {l.labName}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(l.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {l.type} ({l.count} tests)
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formal Medical Briefing Footer */}
            <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-2 print-avoid-break">
              <span>
                Generated from verified patient laboratory reports · Health Timeline
              </span>
              <span>Confidential Medical Information · Multi-page clinical briefing</span>
            </div>
          </div>
        </div>
      </div>
  );
}
