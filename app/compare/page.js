"use client";

import Link from "next/link";
import ComparePanel from "@/components/ComparePanel";
import { useReports } from "@/context/ReportsContext";

export default function ComparePage() {
  const { reports, allTestNames, loading } = useReports();

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

        <Link
          href="/upload"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <span>+ Upload Report</span>
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
          Loading comparison data…
        </div>
      ) : reports.length === 0 ? (
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
        <ComparePanel testNames={allTestNames} reports={reports} />
      )}
    </div>
  );
}

