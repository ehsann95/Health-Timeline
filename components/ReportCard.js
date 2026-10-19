"use client";

import { useState } from "react";

const FLAG_STYLES = {
  HIGH: "bg-red-100 text-red-800 ring-1 ring-red-300",
  LOW: "bg-blue-100 text-blue-800 ring-1 ring-blue-300",
  NORMAL: "bg-green-50 text-green-700 ring-1 ring-green-200",
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

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
      >
        <div>
          <span className="font-semibold">{report.reportType}</span>
          <span className="text-slate-500 text-sm ml-2">
            {fmtDate(report.reportDate)}{report.labName ? ` · ${report.labName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{report.tests.length} tests</span>
          {abnormal.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {abnormal.length} abnormal
            </span>
          )}
          <span className="text-slate-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Test</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2 pr-4">Unit</th>
                  <th className="py-2 pr-4">Reference range</th>
                  <th className="py-2 pr-4">Flag</th>
                  <th className="py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={t.id || i} className={`border-b last:border-0 ${t.flag === "HIGH" ? "bg-red-50" : t.flag === "LOW" ? "bg-blue-50" : ""}`}>
                    <td className="py-2 pr-4 font-medium">
                      {editing ? <input value={t.name} onChange={(e) => updateRow(i, "name", e.target.value)} className="border rounded px-2 py-1 w-40" /> : t.name}
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {editing ? <input value={t.value} onChange={(e) => updateRow(i, "value", e.target.value)} className="border rounded px-2 py-1 w-24" /> : t.value}
                    </td>
                    <td className="py-2 pr-4">{t.unit || "—"}</td>
                    <td className="py-2 pr-4 font-mono text-slate-600">
                      {editing ? (
                        <span className="flex gap-1">
                          <input value={t.refLow ?? ""} onChange={(e) => updateRow(i, "refLow", e.target.value)} className="border rounded px-2 py-1 w-20" placeholder="low" />
                          <input value={t.refHigh ?? ""} onChange={(e) => updateRow(i, "refHigh", e.target.value)} className="border rounded px-2 py-1 w-20" placeholder="high" />
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
                    <td className="py-2 text-slate-500">{t.category}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-400">No parsed values — use Edit to add them manually.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-sm">
            <h4 className="font-semibold mb-1">📝 What this report suggests</h4>
            <p className="whitespace-pre-line text-slate-700">{report.summary || "Loading summary…"}</p>
            <p className="text-xs text-slate-400 mt-2">Rule-based guidance only — not a medical diagnosis. Always consult a doctor.</p>
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={saveEdits} disabled={busy} className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50">
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button onClick={() => { setEditing(false); setRows(report.tests); }} className="border px-3 py-1.5 rounded-md text-sm">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="border px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-100">✏️ Edit values</button>
                <button onClick={deleteReport} className="border border-red-200 text-red-600 px-3 py-1.5 rounded-md text-sm hover:bg-red-50">Delete report</button>
              </>
            )}
          </div>

          {report.rawText && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer">Show extracted raw text</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-slate-900 text-slate-100 p-3 rounded">{report.rawText}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
