"use client";

import { useMemo, useState } from "react";
import { lookupRange } from "@/lib/reference-ranges";

const FLAG_STYLES = {
  HIGH: "bg-red-100 text-red-800 ring-1 ring-red-300",
  LOW: "bg-blue-100 text-blue-800 ring-1 ring-blue-300",
  NORMAL: "bg-green-50 text-green-700 ring-1 ring-green-200",
};

const CATEGORY_META = {
  CBC: { icon: "🩸", label: "Complete Blood Count (CBC)" },
  LFT: { icon: "🧪", label: "Liver Function Test (LFT)" },
  KFT: { icon: "🫘", label: "Kidney Function Test (KFT)" },
  Lipid: { icon: "🫀", label: "Lipid Profile" },
  Thyroid: { icon: "🦋", label: "Thyroid Profile" },
  "Blood Sugar": { icon: "🍬", label: "Blood Sugar / Glucose" },
  Vitamins: { icon: "💊", label: "Vitamins" },
  Iron: { icon: "🧲", label: "Iron Studies" },
  Cardiac: { icon: "❤️", label: "Cardiac Markers" },
  Inflammation: { icon: "🔥", label: "Inflammation" },
  Biochemistry: { icon: "🔬", label: "Biochemistry" },
  Other: { icon: "📋", label: "Other Tests" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReportCard({ report, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(report.tests || []);
  const [busy, setBusy] = useState(false);
  const abnormal = (report.tests || []).filter((t) => t.flag !== "NORMAL");

  const categories = useMemo(() => {
    const cats = [];
    for (const r of rows) {
      const c = r.category || "Other";
      if (!cats.includes(c)) cats.push(c);
    }
    return cats.length ? cats : ["Other"];
  }, [rows]);

  function updateRow(i, field, value) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const updated = { ...r, [field]: value };
        // Auto-fill range and unit when test name matches curated database
        if (field === "name" && typeof value === "string" && value.trim()) {
          const range = lookupRange(value.trim());
          if (range) {
            if (!updated.unit && range.unit) updated.unit = range.unit;
            if ((updated.refLow === "" || updated.refLow == null) && range.low != null) updated.refLow = range.low;
            if ((updated.refHigh === "" || updated.refHigh == null) && range.high != null) updated.refHigh = range.high;
            if (!updated.category || updated.category === "Other") updated.category = range.category;
          }
        }
        return updated;
      })
    );
  }

  function addRow(categoryHint = "Other") {
    setRows((prev) => [
      ...prev,
      {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: "",
        value: "",
        unit: "",
        refLow: "",
        refHigh: "",
        flag: "NORMAL",
        category: categoryHint,
        verified: true,
      },
    ]);
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveEdits() {
    setBusy(true);
    // Filter out completely blank rows
    const validRows = rows.filter((r) => r.name.trim() || r.value !== "");

    const updatedTests = validRows.map((r) => {
      const val = parseFloat(r.value) || 0;
      const low = r.refLow === "" || r.refLow == null ? null : parseFloat(r.refLow);
      const high = r.refHigh === "" || r.refHigh == null ? null : parseFloat(r.refHigh);
      let flag = "NORMAL";
      if (low != null && val < low) flag = "LOW";
      else if (high != null && val > high) flag = "HIGH";
      return {
        ...r,
        name: r.name.trim() || "Unnamed Test",
        category: r.category || "Other",
        value: val,
        refLow: low,
        refHigh: high,
        flag: r.flag || flag,
        verified: true,
      };
    });

    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tests: updatedTests }),
      });
      const data = await res.json();
      if (data.report) {
        setRows(data.report.tests || []);
        onSaved?.(data.report);
      } else {
        setRows(updatedTests);
        onSaved?.({ ...report, tests: updatedTests });
      }
      setEditing(false);
    } catch {
      setRows(updatedTests);
      onSaved?.({ ...report, tests: updatedTests });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function deleteReport() {
    if (!confirm("Delete this report permanently?")) return;
    try {
      await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
    } catch {}
    onDeleted?.(report.id);
  }

  function renderTableRow(t, originalIndex) {
    return (
      <tr
        key={t.id || originalIndex}
        className={`border-b last:border-0 ${t.flag === "HIGH" ? "bg-red-50/70" : t.flag === "LOW" ? "bg-blue-50/70" : ""}`}
      >
        <td className="py-2 pr-3 font-medium">
          {editing ? (
            <input
              value={t.name}
              onChange={(e) => updateRow(originalIndex, "name", e.target.value)}
              placeholder="e.g. Hemoglobin"
              className="border rounded px-2 py-1 w-full max-w-[170px] text-xs bg-white font-medium"
            />
          ) : (
            t.name
          )}
        </td>
        <td className="py-2 pr-3 font-mono font-medium">
          {editing ? (
            <input
              type="number"
              step="any"
              value={t.value}
              onChange={(e) => updateRow(originalIndex, "value", e.target.value)}
              placeholder="0.0"
              className="border rounded px-2 py-1 w-20 text-xs bg-white font-mono"
            />
          ) : (
            t.value
          )}
        </td>
        <td className="py-2 pr-3 text-slate-600">
          {editing ? (
            <input
              value={t.unit || ""}
              onChange={(e) => updateRow(originalIndex, "unit", e.target.value)}
              placeholder="unit"
              className="border rounded px-2 py-1 w-16 text-xs bg-white"
            />
          ) : (
            t.unit || "—"
          )}
        </td>
        <td className="py-2 pr-3 font-mono text-slate-600">
          {editing ? (
            <span className="flex items-center gap-1">
              <input
                type="number"
                step="any"
                value={t.refLow ?? ""}
                onChange={(e) => updateRow(originalIndex, "refLow", e.target.value)}
                className="border rounded px-1.5 py-1 w-14 text-xs bg-white"
                placeholder="low"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                step="any"
                value={t.refHigh ?? ""}
                onChange={(e) => updateRow(originalIndex, "refHigh", e.target.value)}
                className="border rounded px-1.5 py-1 w-14 text-xs bg-white"
                placeholder="high"
              />
            </span>
          ) : (
            `${t.refLow ?? "?"} – ${t.refHigh ?? "?"}`
          )}
        </td>
        {editing && (
          <td className="py-2 pr-3">
            <select
              value={t.category || "Other"}
              onChange={(e) => updateRow(originalIndex, "category", e.target.value)}
              className="border rounded px-1.5 py-1 text-xs bg-white"
            >
              <option value="CBC">CBC</option>
              <option value="LFT">LFT</option>
              <option value="KFT">KFT</option>
              <option value="Lipid">Lipid</option>
              <option value="Thyroid">Thyroid</option>
              <option value="Blood Sugar">Blood Sugar</option>
              <option value="Vitamins">Vitamins</option>
              <option value="Other">Other</option>
            </select>
          </td>
        )}
        <td className="py-2 pr-3">
          {editing ? (
            <button
              onClick={() => removeRow(originalIndex)}
              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 text-xs font-semibold"
              title="Remove this marker"
            >
              ✕
            </button>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FLAG_STYLES[t.flag] || ""}`}>
              {t.flag === "HIGH" ? "▲ HIGH" : t.flag === "LOW" ? "▼ LOW" : "Normal"}
            </span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 transition-colors gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-base text-slate-900">{report.reportType}</span>
          <span className="text-slate-500 text-xs sm:text-sm">
            📅 {fmtDate(report.reportDate)}
          </span>
          {report.labName && (
            <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-200 truncate max-w-[160px] sm:max-w-none">
              🏥 {report.labName}
            </span>
          )}
          {report.patientName && report.patientName !== "Self" && (
            <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-200">
              👤 {report.patientName}
            </span>
          )}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1 ml-0 sm:ml-1">
              {categories.map((c) => (
                <span
                  key={c}
                  className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200"
                >
                  {CATEGORY_META[c]?.icon || "📋"} {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-xs sm:text-sm text-slate-500">{rows.length} tests</span>
          {abnormal.length > 0 && (
            <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
              {abnormal.length} abnormal
            </span>
          )}
          <span className="text-slate-400 text-xs ml-1">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 sm:px-5 py-4 space-y-5">
          {/* Tests table: grouped by category if multi-panel, otherwise single table */}
          {categories.length <= 1 ? (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3 font-medium">Test</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 pr-3 font-medium">Unit</th>
                    <th className="py-2 pr-3 font-medium">Reference range</th>
                    {editing && <th className="py-2 pr-3 font-medium">Category</th>}
                    <th className="py-2 pr-3 font-medium">{editing ? "Remove" : "Flag"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => renderTableRow(t, i))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={editing ? 6 : 5} className="py-4 text-center text-slate-400">
                        No parsed values — click &quot;Add Marker / Test Value&quot; to add them manually.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat] || { icon: "📋", label: `${cat} Tests` };
                const catRows = rows
                  .map((r, originalIdx) => ({ ...r, originalIdx }))
                  .filter((r) => (r.category || "Other") === cat);
                const catAbnormal = catRows.filter((r) => r.flag !== "NORMAL").length;

                return (
                  <div key={cat} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <span className="font-semibold text-sm text-slate-800">{meta.label}</span>
                        <span className="text-xs text-slate-500">({catRows.length} tests)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editing && (
                          <button
                            type="button"
                            onClick={() => addRow(cat)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded transition-colors"
                          >
                            + Add to {cat}
                          </button>
                        )}
                        {catAbnormal > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            {catAbnormal} out of range
                          </span>
                        ) : (
                          <span className="text-xs text-green-700 font-medium">All normal ✓</span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto -mx-1 px-1 py-1">
                      <table className="w-full text-sm min-w-[480px]">
                        <thead>
                          <tr className="text-left text-slate-400 text-xs border-b">
                            <th className="py-2 pr-3 font-medium">Test</th>
                            <th className="py-2 pr-3 font-medium">Value</th>
                            <th className="py-2 pr-3 font-medium">Unit</th>
                            <th className="py-2 pr-3 font-medium">Reference range</th>
                            {editing && <th className="py-2 pr-3 font-medium">Category</th>}
                            <th className="py-2 pr-3 font-medium">{editing ? "Remove" : "Flag"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catRows.map((t) => renderTableRow(t, t.originalIdx))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Marker Button in Edit Mode */}
          {editing && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => addRow()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
              >
                <span>➕</span>
                <span>Add Marker / Test Value</span>
              </button>
              <span className="text-xs text-slate-400">
                Type any biomarker name (e.g. Hemoglobin, SGPT, RBC) to auto-fill ranges and units.
              </span>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4 text-sm border">
            <h4 className="font-semibold mb-1 flex items-center gap-1.5">
              <span>📝</span>
              <span>What this report suggests</span>
            </h4>
            <p className="whitespace-pre-line text-slate-700">{report.summary || "Loading summary…"}</p>
            <p className="text-xs text-slate-400 mt-2">Rule-based guidance only — not a medical diagnosis. Always consult a doctor.</p>
          </div>

          <div className="flex gap-2 pt-1">
            {editing ? (
              <>
                <button
                  onClick={saveEdits}
                  disabled={busy}
                  className="bg-green-600 text-white px-3.5 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setRows(report.tests || []);
                  }}
                  className="border px-3.5 py-1.5 rounded-md text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="border px-3.5 py-1.5 rounded-md text-sm font-medium hover:bg-slate-100 transition-colors"
                >
                  ✏️ Edit / Add values
                </button>
                <button
                  onClick={deleteReport}
                  className="border border-red-200 text-red-600 px-3.5 py-1.5 rounded-md text-sm hover:bg-red-50 transition-colors"
                >
                  Delete report
                </button>
              </>
            )}
          </div>

          {report.rawText && (
            <details className="text-xs text-slate-400 pt-1">
              <summary className="cursor-pointer hover:text-slate-600">Show extracted raw text</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-slate-900 text-slate-100 p-3 rounded">{report.rawText}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
