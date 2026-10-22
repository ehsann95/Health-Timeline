import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/trends?test=hemoglobin
// Returns chronological readings for a given test name across all reports,
// with direction (improving/worsening/stable) computed against the prior value.
const DIRECTIONAL = {
  // true: lower is better (e.g., LDL, ALT), false: higher is better (e.g., Hb, HDL)
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
  return null; // unknown
}

export async function GET(request) {
  try {
    const prisma = await getPrisma();
    const sessionUser = getSessionFromRequest(request);
    const { searchParams } = new URL(request.url);
    const testName = searchParams.get("test")?.trim().toLowerCase();
    if (!testName) {
      return NextResponse.json({ error: "Missing 'test' parameter" }, { status: 400 });
    }

    let whereClause = {};
    if (sessionUser) {
      whereClause = {
        OR: [
          { userId: sessionUser.id },
          { userEmail: sessionUser.email },
        ],
      };
    } else {
      whereClause = { userId: null };
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      include: { tests: true },
      orderBy: { reportDate: "asc" },
    });

    const readings = [];
    for (const r of reports) {
      for (const t of r.tests) {
        if (t.name.toLowerCase().includes(testName)) {
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

    // Compute direction: compare last two readings, factoring in whether
    // moving toward the normal range is an improvement.
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
          // Unknown direction: judge by movement toward reference range midpoint
          const mid = (r) => ((r.refLow ?? 0) + (r.refHigh ?? r.value)) / 2;
          const distPrev = Math.abs(prev.value - mid(prev));
          const distCurr = Math.abs(curr.value - mid(curr));
          direction = distCurr < distPrev ? "IMPROVING" : "WORSENING";
        }
      }
    }

    // Distinct test names for the compare dropdown
    const allTests = [...new Set(reports.flatMap((r) => r.tests.map((t) => t.name)))].sort();

    return NextResponse.json({ testName, readings, direction, allTests });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
