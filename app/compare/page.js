"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ComparePanel from "@/components/ComparePanel";
import { useReports } from "@/context/ReportsContext";

export default function ComparePage() {
  const { reports, allMembers, loading } = useReports();
  const [selectedMember, setSelectedMember] = useState("All");

  const memberReports = useMemo(() => {
    if (selectedMember === "All") return reports;
    return reports.filter((r) => (r.patientName || "Self").toLowerCase() === selectedMember.toLowerCase());
  }, [reports, selectedMember]);

  const memberTestNames = useMemo(() => {
    return [...new Set(memberReports.flatMap((r) => (r.tests || []).map((t) => t.name)))].filter(Boolean).sort();
  }, [memberReports]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <span>←</span>
            <span>Back to Timeline</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Biomarker Trends &amp; Comparison</h1>
          <p className="text-sm text-slate-500">
            Compare specific test values across your laboratory visits to visualize trajectory and clinical normal ranges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {allMembers.length > 1 && (
            <div className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm shadow-xs">
              <span className="text-slate-500 text-xs font-medium">Viewing:</span>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 text-sm focus:outline-none"
              >
                <option value="All">All Family</option>
                {allMembers.map((m) => (
                  <option key={m} value={m}>
                    👤 {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Link
            href="/upload"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <span>+ Upload</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
          Loading comparison data…
        </div>
      ) : memberReports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center space-y-4">
          <div className="text-4xl">📈</div>
          <h3 className="text-lg font-bold text-slate-800">No lab reports available to compare</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Upload two or more lab reports over time to visualize biomarker trends, directional changes, and reference ranges.
          </p>
          <div>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Upload Your First Report →
            </Link>
          </div>
        </div>
      ) : (
        <ComparePanel testNames={memberTestNames} reports={memberReports} />
      )}
    </div>
  );
}
