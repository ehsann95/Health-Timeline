"use client";

import { useMemo, useState } from "react";

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
  const [rows, setRows] = useState(report.tests);
  const [busy, setBusy] = useState(false);
  const abnormal = report.tests.filter((t) => t.flag !== "NORMAL");

  const categories = useMemo(() => {
    const cats = [];
    for (const r of rows) {
      const c = r.category || "Other";
      if (!cats.includes(c)) cats.push(c);
    }
    return cats;
  }, [rows]);

  function updateRow(i, field, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function saveEdits() {
    setBusy(true);
    const updatedTests = rows.map((r) => {
      const val = parseFloat(r.value);
      const low = r.refLow === "" || r.refLow == null ? null : parseFloat(r.refLow);
      const high = r.refHigh === "" || r.refHigh == null ? null : parseFloat(r.refHigh);
      let flag = "NORMAL";
      if (low != null && val < low) flag = "LOW";
      else if (high != null && val > high) flag = "HIGH";
      return {
        ...r,
        value: val,
        refLow: low,
        refHigh: high,
        flag: r.flag || flag,
        verified: true,
      };
    });

    const updatedReport = {
      ...report,
      tests: updatedTests,
    };

    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tests: updatedTests }),
      });
      const data = await res.json();
      if (data.report) {
        setRows(data.report.tests);
        onSaved?.(data.report);
      } else {
        setRows(updatedTests);
        onSaved?.(updatedReport);
      }
      setEditing(false);
    } catch {
      setRows(updatedTests);
      onSaved?.(updatedReport);
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
        <td className="py-2 pr-4 font-medium">
          {editing ? (
            <input
              value={t.name}
              onChange={(e) => updateRow(originalIndex, "name", e.target.value)}
              className="border rounded px-2 py-1 w-40"
            />
          ) : (
            t.name
          )}
        </td>
        <td className="py-2 pr-4 font-mono font-medium">
          {editing ? (
            <input
              value={t.value}
              onChange={(e) => updateRow(originalIndex, "value", e.target.value)}
              className="border rounded px-2 py-1 w-24"
            />
          ) : (
            t.value
          )}
        </td>
        <td className="py-2 pr-4 text-slate-600">{t.unit || "—"}</td>
        <td className="py-2 pr-4 font-mono text-slate-600">
          {editing ? (
            <span className="flex gap-1">
              <input
                value={t.refLow ?? ""}
                onChange={(e) => updateRow(originalIndex, "refLow", e.target.value)}
                className="border rounded px-2 py-1 w-20"
                placeholder="low"
              />
              <input
                value={t.refHigh ?? ""}
                onChange={(e) => updateRow(originalIndex, "refHigh", e.target.value)}
                className="border rounded px-2 py-1 w-20"
                placeholder="high"
              />
            </span>
          ) : (
            `${t.refLow ?? "?"} – ${t.refHigh ?? "?"}`
          )}
        </td>
        <td className="py-2 pr-4">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FLAG_STYLES[t.flag] || ""}`}>
            {t.flag === "HIGH" ? "▲ HIGH" : t.flag === "LOW" ? "▼ LOW" : "Normal"}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-base text-slate-900">{report.reportType}</span>
          <span className="text-slate-500 text-sm">
            📅 {fmtDate(report.reportDate)}
          </span>
          {report.labName && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-200">
              🏥 {report.labName}
            </span>
          )}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1 ml-1">
              {categories.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200"
                >
                  {CATEGORY_META[c]?.icon || "📋"} {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{report.tests.length} tests</span>
          {abnormal.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {abnormal.length} abnormal
            </span>
          )}
          <span className="text-slate-400 text-xs ml-1">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-5">
          {/* Tests table: grouped by category if multi-panel, otherwise single table */}
          {categories.length <= 1 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-4 font-medium">Test</th>
                    <th className="py-2 pr-4 font-medium">Value</th>
                    <th className="py-2 pr-4 font-medium">Unit</th>
                    <th className="py-2 pr-4 font-medium">Reference range</th>
                    <th className="py-2 pr-4 font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => renderTableRow(t, i))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No parsed values — use Edit to add them manually.
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
                      {catAbnormal > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          {catAbnormal} out of range
                        </span>
                      ) : (
                        <span className="text-xs text-green-700 font-medium">All normal ✓</span>
                      )}
                    </div>
                    <div className="overflow-x-auto px-3.5 py-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400 text-xs border-b">
                            <th className="py-2 pr-4 font-medium">Test</th>
                            <th className="py-2 pr-4 font-medium">Value</th>
                            <th className="py-2 pr-4 font-medium">Unit</th>
                            <th className="py-2 pr-4 font-medium">Reference range</th>
                            <th className="py-2 pr-4 font-medium">Flag</th>
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
                  className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setRows(report.tests);
                  }}
                  className="border px-3 py-1.5 rounded-md text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="border px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-100"
                >
                  ✏️ Edit values
                </button>
                <button
                  onClick={deleteReport}
                  className="border border-red-200 text-red-600 px-3 py-1.5 rounded-md text-sm hover:bg-red-50"
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
