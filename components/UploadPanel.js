"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useReports } from "@/context/ReportsContext";

export default function UploadPanel({ onUploaded }) {
  const { addReport, allMembers } = useReports();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [reportType, setReportType] = useState("Auto-Detect");
  const [labName, setLabName] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [patientName, setPatientName] = useState("Self");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastUploaded, setLastUploaded] = useState(null);

  const fileInputRef = useRef(null);

  function resetForm() {
    setFile(null);
    setLabName("");
    setReportDate("");
    setReportType("Auto-Detect");
    setPatientName("Self");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setStatus(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setStatus(null);
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
      }
    }
  }

  function handleRemoveFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      return setStatus({ type: "error", msg: "Please choose or drop a PDF or image report file first." });
    }
    if (!labName.trim()) {
      return setStatus({ type: "error", msg: "Please provide the Laboratory / Diagnostic center name." });
    }
    if (!reportDate) {
      return setStatus({ type: "error", msg: "Please select the report collection or test date." });
    }

    setBusy(true);
    setStatus(null);
    setLastUploaded(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("reportType", reportType);
      fd.append("labName", labName.trim());
      fd.append("reportDate", reportDate);
      fd.append("patientName", patientName.trim() || "Self");

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Save report in context & localStorage
      addReport(data.report);
      onUploaded?.(data.report);

      setLastUploaded({
        report: data.report,
        parsedCount: data.parsedCount,
        extractionMethod: data.extractionMethod,
      });

      setStatus({
        type: "ok",
        msg: `Successfully parsed ${data.parsedCount} biomarker test values via ${data.extractionMethod}.`,
      });

      // Complete form reset upon successful upload
      resetForm();
    } catch (err) {
      setStatus({ type: "error", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Success Banner & Call-to-actions */}
      {status?.type === "ok" && lastUploaded && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm text-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <h3 className="font-semibold text-emerald-900 text-base">
                  Report Uploaded &amp; Parsed Successfully!
                </h3>
                <p className="text-sm text-emerald-700">
                  Extracted <span className="font-bold">{lastUploaded.parsedCount} biomarker values</span> for{" "}
                  <span className="font-medium text-emerald-900">{lastUploaded.report.reportType}</span> from{" "}
                  <span className="font-medium text-emerald-900">{lastUploaded.report.labName}</span> on{" "}
                  {new Date(lastUploaded.report.reportDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  .
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setStatus(null);
                setLastUploaded(null);
              }}
              className="text-emerald-600 hover:text-emerald-800 text-sm font-semibold p-1"
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <span>📋 View in Timeline</span>
              <span>→</span>
            </Link>
            <button
              onClick={() => {
                setStatus(null);
                setLastUploaded(null);
              }}
              className="inline-flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-medium text-sm px-3.5 py-2 rounded-lg transition-colors"
            >
              <span>+ Upload Another Report</span>
            </button>
          </div>
        </div>
      )}

      {/* Upload Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Upload &amp; Extract Lab Report</h2>
          <p className="text-sm text-slate-500">
            Upload your laboratory PDF or photo to extract and track your biomarkers automatically.
          </p>
        </div>

        {/* Drag & Drop File Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            dragOver
              ? "border-blue-500 bg-blue-50/60"
              : file
              ? "border-emerald-300 bg-emerald-50/40"
              : "border-slate-300 bg-slate-50 hover:bg-slate-100/70"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="report-file-input"
          />

          {!file ? (
            <label htmlFor="report-file-input" className="cursor-pointer block space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                📁
              </div>
              <p className="text-sm font-medium text-slate-800">
                Click to browse or drag &amp; drop your lab file here
              </p>
              <p className="text-xs text-slate-500">
                Supports PDF reports (single &amp; multi-panel) or clear JPG/PNG photo scans
              </p>
            </label>
          ) : (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-center gap-3 truncate">
                <span className="text-2xl">
                  {file.name.toLowerCase().endsWith(".pdf") ? "📄" : "🖼️"}
                </span>
                <div className="text-left truncate">
                  <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB · Ready to parse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="text-slate-400 hover:text-red-600 px-2 py-1 text-sm rounded hover:bg-slate-100 transition-colors"
                title="Remove file"
              >
                ✕ Remove
              </button>
            </div>
          )}
        </div>

        {/* Required Metadata Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">
              Lab Name <span className="text-red-500">*</span>
            </span>
            <input
              required
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. CityLab Diagnostics, Quest, Jasper"
            />
          </label>

          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">
              Report Date <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>

          <label className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">Report Type / Panel</span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Auto-Detect">✨ Auto-Detect Panels (Recommended)</option>
              <option value="CBC">CBC (Complete Blood Count)</option>
              <option value="LFT">LFT (Liver Function)</option>
              <option value="KFT">KFT (Kidney Function)</option>
              <option value="Lipid">Lipid Profile</option>
              <option value="Thyroid">Thyroid Profile</option>
              <option value="Blood Sugar">Blood Sugar / HbA1c</option>
              <option value="Vitamins">Vitamins</option>
              <option value="Comprehensive Panel">Comprehensive Panel</option>
              <option value="Other">Other</option>
            </select>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Auto-detects multi-panel PDFs (e.g. CBC + LFT + KFT)
            </span>
          </label>

          <div className="text-sm block">
            <span className="block mb-1 font-medium text-slate-700">Patient / Family Member</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={allMembers && allMembers.includes(patientName) ? patientName : "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setPatientName("");
                  } else {
                    setPatientName(e.target.value);
                  }
                }}
                className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(allMembers || ["Self"]).map((m) => (
                  <option key={m} value={m}>
                    👤 {m}
                  </option>
                ))}
                {!allMembers?.includes("Father") && <option value="Father">👨 Father</option>}
                {!allMembers?.includes("Mother") && <option value="Mother">👩 Mother</option>}
                {!allMembers?.includes("Spouse") && <option value="Spouse">💍 Spouse</option>}
                {!allMembers?.includes("Child") && <option value="Child">👶 Child</option>}
                <option value="custom">+ Other / Custom…</option>
              </select>
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Name or Relation (e.g. Dad)"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {busy ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  <span>Extracting Biomarkers…</span>
                </>
              ) : (
                <>
                  <span>Upload &amp; Parse</span>
                  <span>→</span>
                </>
              )}
            </button>
            {file && !busy && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear form
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 max-w-xs text-right">
            PDF text extracts directly; photo scans run local OCR.
          </span>
        </div>

        {/* Error notification */}
        {status?.type === "error" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <span>⚠️</span>
            <span>{status.msg}</span>
          </div>
        )}
      </form>
    </div>
  );
}
