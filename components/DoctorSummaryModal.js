"use client";

import { useMemo, useState } from "react";
import { useReports } from "@/context/ReportsContext";

export default function DoctorSummaryModal({ isOpen, onClose }) {
  const { reports, allMembers } = useReports();
  const [selectedMember, setSelectedMember] = useState("All");

  // Filter reports by selected family member
  const memberReports = useMemo(() => {
    if (selectedMember === "All") return reports;
    return reports.filter((r) => (r.patientName || "Self").toLowerCase() === selectedMember.toLowerCase());
  }, [reports, selectedMember]);

  // Compute test histories for this member
  const { abnormalTests, testTrajectories, recentLabs } = useMemo(() => {
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
            category: t.category,
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

    const trajectories = Array.from(testMap.values()).map((item) => {
      const latest = item.readings[0];
      const previous = item.readings[1] || null;
      let trend = "STABLE";
      if (previous && latest.value !== previous.value) {
        trend = latest.value > previous.value ? "INCREASING" : "DECREASING";
      }
      return {
        ...item,
        latest,
        previous,
        trend,
      };
    });

    const recentLabsList = sorted.slice(0, 5).map((r) => ({
      date: r.reportDate,
      labName: r.labName || "Diagnostic Lab",
      type: r.reportType,
      count: r.tests?.length || 0,
    }));

    return {
      abnormalTests: abnormalList.slice(0, 8),
      testTrajectories: trajectories,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-auto overflow-hidden print:border-0 print:shadow-none print:max-w-none print:rounded-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">🩺</span>
            <span className="font-semibold text-sm sm:text-base">Doctor Consultation Briefing</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <span>🖨️</span>
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Clinical Document Content (Prints cleanly) */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 font-sans print:p-4 print:text-black">
          {/* Clinical Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-blue-600">
                Patient Health Summary
              </p>
              <h1 className="text-2xl font-bold text-slate-900">Clinical Laboratory Briefing</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Prepared for physician review · Generated on {todayFormatted}
              </p>
            </div>

            {/* Member Switcher (Controls print selection) */}
            <div className="print:hidden">
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Patient Profile:
              </label>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1 text-xs font-semibold bg-white shadow-sm"
              >
                <option value="All">All Family Records</option>
                {allMembers.map((m) => (
                  <option key={m} value={m}>
                    👤 {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden print:block text-right text-xs">
              <p className="font-bold text-sm">{selectedMember === "All" ? "Family Records" : selectedMember}</p>
              <p className="text-slate-500">Date: {todayFormatted}</p>
            </div>
          </div>

          {/* Demographic & Meta Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs print:bg-white print:border-slate-300">
            <div>
              <span className="text-slate-500 block">Patient Name</span>
              <span className="font-bold text-slate-900 text-sm">
                {selectedMember === "All" ? "All Profiles" : selectedMember}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Reports</span>
              <span className="font-bold text-slate-900 text-sm">{memberReports.length}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Biomarkers Tracked</span>
              <span className="font-bold text-slate-900 text-sm">{testTrajectories.length}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Flagged Out-of-Range</span>
              <span className={`font-bold text-sm ${abnormalTests.length > 0 ? "text-red-600" : "text-green-600"}`}>
                {abnormalTests.length} tests
              </span>
            </div>
          </div>

          {/* Critical Abnormal Alerts Box */}
          {abnormalTests.length > 0 ? (
            <div className="border border-red-300 bg-red-50/70 rounded-xl p-4 space-y-2 print:border-red-500">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Critical / Out-of-Range Findings Requiring Attention</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {abnormalTests.map((t, i) => (
                  <div
                    key={i}
                    className="bg-white p-2.5 rounded-lg border border-red-200 flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{t.name}</span>
                      <span className="text-[11px] text-slate-500">
                        Ref: {t.refLow ?? "?"} – {t.refHigh ?? "?"} {t.unit}
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

          {/* Comprehensive Biomarker Trajectory Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Biomarker Readings &amp; Directional Trajectory
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold print:bg-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Biomarker</th>
                    <th className="py-2.5 px-3">Latest Value</th>
                    <th className="py-2.5 px-3">Previous</th>
                    <th className="py-2.5 px-3">Reference Range</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {testTrajectories.slice(0, 15).map((item) => (
                    <tr
                      key={item.name}
                      className={item.latest?.flag !== "NORMAL" ? "bg-red-50/40" : "hover:bg-slate-50"}
                    >
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {item.name}
                        {item.category && item.category !== "Other" && (
                          <span className="ml-1.5 text-[10px] text-slate-500">({item.category})</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {item.latest?.value} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {item.previous ? `${item.previous.value} ${item.unit}` : "—"}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {item.refLow != null && item.refHigh != null
                          ? `${item.refLow} – ${item.refHigh} ${item.unit || ""}`
                          : "Standard"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.latest?.flag === "HIGH"
                              ? "bg-red-100 text-red-800"
                              : item.latest?.flag === "LOW"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {item.latest?.flag === "HIGH"
                            ? "HIGH"
                            : item.latest?.flag === "LOW"
                            ? "LOW"
                            : "NORMAL"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Laboratory Visits */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Source Laboratory Visits
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {recentLabs.map((l, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700">
                  <span className="font-medium">{l.labName}</span> ·{" "}
                  <span className="text-slate-500">{new Date(l.date).toLocaleDateString("en-GB")}</span> (
                  {l.type})
                </div>
              ))}
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Generated from patient-uploaded lab reports via Health Timeline</span>
            <span>Confidential Medical Information</span>
          </div>
        </div>
      </div>
    </div>
  );
}

