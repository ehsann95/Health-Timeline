"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

const DIRECTION_BADGE = {
  IMPROVING: { text: "📉 Improving", cls: "bg-green-100 text-green-700 border-green-200" },
  WORSENING: { text: "📈 Worsening", cls: "bg-red-100 text-red-700 border-red-200" },
  STABLE: { text: "➡️ Stable", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

const DIRECTIONAL = {
  alt: true, sgpt: true, ast: true, sgot: true,
  creatinine: true, urea: true, "blood urea": true,
  ldl: true, triglycerides: true, "total cholesterol": true,
  crp: true, "uric acid": true, tsh: true, esr: true,
  hba1c: true, fbs: true, "fasting blood sugar": true,
  hemoglobin: false, hdl: false, "vitamin d": false,
  "vitamin b12": false, platelet: false, rbc: false, egfr: false, gfr: false,
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
  const lower = testName.toLowerCase().trim();
  for (const r of sortedReports) {
    for (const t of r.tests || []) {
      if ((t.name || "").toLowerCase().trim() === lower || (t.name || "").toLowerCase().includes(lower)) {
        readings.push({
          date: r.reportDate || r.createdAt,
          reportId: r.id,
          reportType: r.reportType,
          labName: r.labName,
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
  // Count how many readings exist for each test name
  const testCounts = useMemo(() => {
    const counts = {};
    for (const r of reports) {
      for (const t of r.tests || []) {
        if (t.name) {
          counts[t.name] = (counts[t.name] || 0) + 1;
        }
      }
    }
    return counts;
  }, [reports]);

  // Only list tests with at least 2 readings by default (real comparisons)
  const [showSingleReadings, setShowSingleReadings] = useState(false);

  const comparableTestNames = useMemo(() => {
    return testNames.filter((n) => (testCounts[n] || 0) >= 2);
  }, [testNames, testCounts]);

  const singleReadingTestNames = useMemo(() => {
    return testNames.filter((n) => (testCounts[n] || 0) === 1);
  }, [testNames, testCounts]);

  const displayedTestNames = showSingleReadings ? testNames : comparableTestNames;

  const [selected, setSelected] = useState(comparableTestNames[0] || testNames[0] || "");
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

  // Sync selection when comparable tests change
  useEffect(() => {
    if (comparableTestNames.length > 0 && !comparableTestNames.includes(selected) && !showSingleReadings) {
      setSelected(comparableTestNames[0]);
    } else if (!selected && displayedTestNames.length > 0) {
      setSelected(displayedTestNames[0]);
    }
  }, [comparableTestNames, displayedTestNames, selected, showSingleReadings]);

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
    unit: r.unit,
    flag: r.flag,
    labName: r.labName,
  }));

  // Find consistent reference ranges and unit
  const refLow = chartData.find((r) => r.refLow != null)?.refLow;
  const refHigh = chartData.find((r) => r.refHigh != null)?.refHigh;
  const unit = chartData.find((r) => r.unit)?.unit || "";
  const latestReading = chartData[chartData.length - 1];

  // Dynamic Y-Domain to ensure reference lines and data dots have clean breathing room
  const yDomain = useMemo(() => {
    if (!chartData.length) return ["auto", "auto"];
    const values = chartData.map((d) => d.value).filter((v) => typeof v === "number" && !isNaN(v));
    const lows = chartData.map((d) => d.refLow).filter((v) => typeof v === "number" && !isNaN(v));
    const highs = chartData.map((d) => d.refHigh).filter((v) => typeof v === "number" && !isNaN(v));
    const all = [...values, ...lows, ...highs];
    if (!all.length) return ["auto", "auto"];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || (max * 0.2) || 1;
    const yMin = Math.max(0, parseFloat((min - span * 0.15).toFixed(1)));
    const yMax = parseFloat((max + span * 0.15).toFixed(1));
    return [yMin, yMax];
  }, [chartData]);

  const badge = DIRECTION_BADGE[data?.direction] || DIRECTION_BADGE.STABLE;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5">
      {/* Header & Test Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">Biomarker Trajectory</h2>
          <p className="text-xs text-slate-500">
            Comparing tests with multiple readings over time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {comparableTestNames.length === 0 && !showSingleReadings ? (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              No tests with ≥ 2 readings found yet
            </span>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs max-w-full sm:max-w-xs"
            >
              <option value="">— Choose a biomarker to compare —</option>
              {displayedTestNames.map((n) => (
                <option key={n} value={n}>
                  {n} {testCategoryMap[n] ? `(${testCategoryMap[n]})` : ""} · {testCounts[n] || 1} readings
                </option>
              ))}
            </select>
          )}

          {singleReadingTestNames.length > 0 && (
            <label className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSingleReadings}
                onChange={(e) => setShowSingleReadings(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Show single readings ({singleReadingTestNames.length})</span>
            </label>
          )}
        </div>
      </div>

      {/* No comparable tests alert */}
      {comparableTestNames.length === 0 && !showSingleReadings && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900 space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <span>ℹ️</span>
            <span>Why is this list empty?</span>
          </p>
          <p className="text-xs text-blue-700">
            Comparison requires at least 2 readings taken on different dates. Upload your next report to visualize trends, or check &quot;Show single readings&quot; above to inspect single test values.
          </p>
        </div>
      )}

      {loading && <p className="text-sm text-slate-500 py-6 text-center">Loading trend data…</p>}
      {error && <p className="text-sm text-red-600 py-4">{error}</p>}

      {data && chartData.length >= 1 && (
        <>
          {/* Normal Range & Trajectory Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-slate-500 block">Selected Test:</span>
                <span className="font-bold text-slate-900 text-sm">{selected}</span>
              </div>

              {/* Normal Range Marker Display */}
              <div className="border-l border-slate-200 pl-3">
                <span className="text-slate-500 block">Clinical Normal Range:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1 text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {refLow != null && refHigh != null
                    ? `${refLow} – ${refHigh} ${unit}`
                    : refHigh != null
                    ? `< ${refHigh} ${unit}`
                    : refLow != null
                    ? `> ${refLow} ${unit}`
                    : "Standard reference range"}
                </span>
              </div>

              {latestReading && (
                <div className="border-l border-slate-200 pl-3">
                  <span className="text-slate-500 block">Latest Reading:</span>
                  <span
                    className={`font-bold text-sm ${
                      latestReading.flag === "HIGH"
                        ? "text-red-600"
                        : latestReading.flag === "LOW"
                        ? "text-blue-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {latestReading.value} {unit} ({latestReading.flag})
                  </span>
                </div>
              )}
            </div>

            {chartData.length >= 2 && (
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${badge.cls}`}>
                {chartData.length} readings · {badge.text}
              </span>
            )}
          </div>

          {/* Recharts Trend Line Graph with Reference Range Markers */}
          {chartData.length >= 2 ? (
            <div className="h-72 sm:h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 25, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={{ stroke: "#cbd5e1" }}
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={{ stroke: "#cbd5e1" }}
                    unit={` ${unit}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(val) => [`${val} ${unit}`, selected]}
                    labelFormatter={(label, items) => {
                      const item = items?.[0]?.payload;
                      return `${label} · ${item?.labName || "Diagnostic Lab"}`;
                    }}
                  />

                  {/* Shaded Green Normal Range Area */}
                  {refLow != null && refHigh != null && (
                    <ReferenceArea
                      y1={refLow}
                      y2={refHigh}
                      fill="#22c55e"
                      fillOpacity={0.09}
                    />
                  )}

                  {/* Normal Range Lower Bound Line */}
                  {refLow != null && (
                    <ReferenceLine
                      y={refLow}
                      stroke="#16a34a"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Min: ${refLow} ${unit}`,
                        position: "insideBottomLeft",
                        fill: "#15803d",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                  )}

                  {/* Normal Range Upper Bound Line */}
                  {refHigh != null && (
                    <ReferenceLine
                      y={refHigh}
                      stroke="#dc2626"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Max: ${refHigh} ${unit}`,
                        position: "insideTopLeft",
                        fill: "#b91c1c",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                  )}

                  {/* Trend Line with highlighted dots for abnormal readings */}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={(dotProps) => {
                      const { cx, cy, payload } = dotProps;
                      const isAbnormal = payload.flag === "HIGH" || payload.flag === "LOW";
                      return (
                        <circle
                          key={`${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={isAbnormal ? 5.5 : 4}
                          fill={isAbnormal ? "#ef4444" : "#2563eb"}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 7, stroke: "#2563eb", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              Only one reading recorded so far ({latestReading?.value} {unit} on {latestReading?.date}). Upload more reports over time to see the trend trajectory graph.
            </div>
          )}

          {/* Historical Readings Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reading</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Normal Range</th>
                  <th className="py-2.5 px-3">Lab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...data.readings].reverse().map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.flag === "HIGH"
                        ? "bg-red-50/60"
                        : r.flag === "LOW"
                        ? "bg-blue-50/60"
                        : "hover:bg-slate-50"
                    }
                  >
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {new Date(r.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">
                      {r.value} {r.unit}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.flag === "HIGH"
                            ? "bg-red-100 text-red-800"
                            : r.flag === "LOW"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {r.flag}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {r.refLow != null && r.refHigh != null
                        ? `${r.refLow} – ${r.refHigh} ${r.unit || ""}`
                        : "Standard"}
                    </td>
                    <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                      {r.labName || r.reportType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
