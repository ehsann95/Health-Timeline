"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceDot, CartesianGrid } from "recharts";

const DIRECTION_BADGE = {
  IMPROVING: { text: "📉 Improving", cls: "bg-green-100 text-green-700" },
  WORSENING: { text: "📈 Worsening", cls: "bg-red-100 text-red-700" },
  STABLE: { text: "➡️ Stable", cls: "bg-slate-100 text-slate-600" },
};

const DIRECTIONAL = {
  "alt": true, "sgpt": true, "ast": true, "sgot": true,
  "creatinine": true, "urea": true, "blood urea": true,
  "ldl": true, "triglycerides": true, "total cholesterol": true,
  "crp": true, "uric acid": true, "tsh": true, "esr": true,
  "hba1c": true, "fbs": true, "fasting blood sugar": true,
  "hemoglobin": false, "hdl": false, "vitamin d": false,
  "vitamin b12": false, "platelet": false, "rbc": false, "egfr": false, "gfr": false,
};

function directionFor(testName) {
  const lower = testName.toLowerCase();
  for (const [key, lowerIsBetter] of Object.entries(DIRECTIONAL)) {
    if (lower.includes(key)) return lowerIsBetter;
  }
  return null;
}

function computeTrendFromReports(testName, reportsList) {
  if (!testName || !reportsList || !reportsList.length) return null;
  const sortedReports = [...reportsList].sort(
    (a, b) => new Date(a.reportDate || a.createdAt) - new Date(b.reportDate || b.createdAt)
  );

  const readings = [];
  const lower = testName.toLowerCase();
  for (const r of sortedReports) {
    for (const t of r.tests || []) {
      if ((t.name || "").toLowerCase().includes(lower)) {
        readings.push({
          date: r.reportDate || r.createdAt,
          reportId: r.id,
          reportType: r.reportType,
          value: t.value,
          unit: t.unit,
          refLow: t.refLow,
          refHigh: t.refHigh,
          flag: t.flag,
        });
      }
    }
  }

  let direction = "STABLE";
  if (readings.length >= 2) {
    const prev = readings[readings.length - 2];
    const curr = readings[readings.length - 1];
    if (curr.value !== prev.value) {
      const lowerIsBetter = directionFor(testName);
      if (lowerIsBetter != null) {
        const improving = lowerIsBetter ? curr.value < prev.value : curr.value > prev.value;
        direction = improving ? "IMPROVING" : "WORSENING";
      } else {
        const mid = (r) => ((r.refLow ?? 0) + (r.refHigh ?? r.value)) / 2;
        const distPrev = Math.abs(prev.value - mid(prev));
        const distCurr = Math.abs(curr.value - mid(curr));
        direction = distCurr < distPrev ? "IMPROVING" : "WORSENING";
      }
    }
  }

  return { testName, readings, direction };
}

export default function ComparePanel({ testNames = [], reports = [] }) {
  const [selected, setSelected] = useState(testNames[0] || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testCategoryMap = useMemo(() => {
    const map = {};
    for (const r of reports) {
      for (const t of r.tests || []) {
        if (t.name && t.category && t.category !== "Other") {
          map[t.name] = t.category;
        }
      }
    }
    return map;
  }, [reports]);

  useEffect(() => {
    if (!selected && testNames.length > 0) {
      setSelected(testNames[0]);
    }
  }, [testNames, selected]);

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }

    if (reports && reports.length > 0) {
      const computed = computeTrendFromReports(selected, reports);
      if (computed && computed.readings.length > 0) {
        setData(computed);
        setLoading(false);
        setError(null);
        return;
      }
    }

    loadTestFromServer(selected);
  }, [selected, reports]);

  async function loadTestFromServer(name) {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trends?test=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const chartData = (data?.readings || []).map((r) => ({
    date: new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
    value: r.value,
    refLow: r.refLow,
    refHigh: r.refHigh,
  }));
  const badge = DIRECTION_BADGE[data?.direction] || DIRECTION_BADGE.STABLE;

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Compare over time</h2>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">— pick a test —</option>
          {testNames.map((n) => (
            <option key={n} value={n}>
              {n}{testCategoryMap[n] ? ` (${testCategoryMap[n]})` : ""}
            </option>
          ))}
        </select>
        {data && data.readings.length >= 1 && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
            {data.readings.length} reading{data.readings.length > 1 ? "s" : ""} · {badge.text}
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading trend…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && chartData.length === 0 && (
        <p className="text-sm text-slate-500">No readings found for this test.</p>
      )}

      {data && chartData.length >= 1 && chartData.length < 2 && (
        <p className="text-sm text-slate-500">
          Only one reading so far — upload more reports over time to see the trend.
        </p>
      )}

      {data && chartData.length >= 2 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ fontSize: 13 }}
                formatter={(val, name) => [val, name === "value" ? selected : name]}
              />
              {/* shaded normal band */}
              <ReferenceArea
                y1={chartData[0].refLow}
                y2={chartData[0].refHigh}
                fill="#22c55e"
                fillOpacity={0.08}
                stroke="#22c55e"
                strokeOpacity={0.3}
                strokeDasharray="4 4"
                label={{ value: "normal range", fontSize: 11, fill: "#16a34a", position: "insideTopRight" }}
              />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data && chartData.length >= 2 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1.5 pr-4">Date</th>
              <th className="py-1.5 pr-4">Value</th>
              <th className="py-1.5">Report</th>
            </tr>
          </thead>
          <tbody>
            {[...data.readings].reverse().map((r, i) => (
              <tr key={i} className={`border-b last:border-0 ${r.flag === "HIGH" ? "bg-red-50" : r.flag === "LOW" ? "bg-blue-50" : ""}`}>
                <td className="py-1.5 pr-4">{new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td className="py-1.5 pr-4 font-mono">{r.value} {r.unit}</td>
                <td className="py-1.5">{r.reportType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
