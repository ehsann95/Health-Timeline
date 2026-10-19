"use client";

import { useState } from "react";

export default function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [reportType, setReportType] = useState("CBC");
  const [labName, setLabName] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setStatus({ type: "error", msg: "Choose a PDF or image file first" });
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("reportType", reportType);
      fd.append("labName", labName);
      fd.append("reportDate", reportDate);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setStatus({
        type: "ok",
        msg: `Parsed ${data.parsedCount} test values (via ${data.extractionMethod}). Check the report below — use Edit to fix any misread values.`,
      });
      setFile(null);
      onUploaded?.();
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
      <h2 className="text-lg font-semibold">Upload Lab Report</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-600">Report type</span>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            {["CBC", "LFT", "KFT", "Lipid", "Thyroid", "Vitamin D", "Vitamin B12", "Blood Sugar", "Other"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-600">Lab name (optional)</span>
          <input
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
            placeholder="e.g. CityLab Diagnostics"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-600">Report date</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-600">File (PDF / JPG / PNG)</span>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border rounded-md px-3 py-1.5 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-100"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Processing…" : "Upload & Parse"}
        </button>
        <span className="text-xs text-slate-500">
          Text-based PDFs parse automatically; photos/scans use on-device OCR (may be slower).
        </span>
      </div>
      {status && (
        <p className={`text-sm ${status.type === "ok" ? "text-green-700" : "text-red-700"}`}>
          {status.msg}
        </p>
      )}
    </form>
  );
}
