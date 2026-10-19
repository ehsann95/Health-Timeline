import { NextResponse } from "next/server";
import { buildSummary } from "@/lib/extractor";
import { getPrisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const flag = searchParams.get("flag") || "";       // "" | HIGH | LOW | ABNORMAL | NORMAL
    const reportType = searchParams.get("reportType") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const reports = await prisma.report.findMany({
      include: { tests: true },
      orderBy: { reportDate: "desc" },
    });

    let filtered = reports.map((r) => ({
      ...r,
      summary: buildSummary(r.tests),
    }));
    if (reportType) {
      filtered = filtered.filter((r) =>
        r.reportType.toLowerCase().includes(reportType.toLowerCase())
      );
    }
    if (from) {
      const fromDate = new Date(from);
      filtered = filtered.filter(
        (r) => r.reportDate && r.reportDate >= fromDate
      );
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => r.reportDate && r.reportDate <= toDate);
    }
    if (q || flag) {
      filtered = filtered.map((r) => {
        let tests = r.tests;
        if (flag === "ABNORMAL") tests = tests.filter((t) => t.flag !== "NORMAL");
        else if (flag) tests = tests.filter((t) => t.flag === flag);
        if (q) {
          const needle = q.toLowerCase();
          tests = tests.filter(
            (t) =>
              t.name.toLowerCase().includes(needle) ||
              r.reportType.toLowerCase().includes(needle) ||
              (r.labName || "").toLowerCase().includes(needle)
          );
        }
        return { ...r, tests };
      });
      filtered = filtered.filter(
        (r) => r.tests.length > 0 || (!q && !flag) || r.rawText?.toLowerCase().includes(q.toLowerCase())
      );
    }

    const summary = {
      totalReports: filtered.length,
      totalTests: filtered.reduce((n, r) => n + r.tests.length, 0),
      abnormalTests: filtered.reduce(
        (n, r) => n + r.tests.filter((t) => t.flag !== "NORMAL").length,
        0
      ),
    };

    return NextResponse.json({ reports: filtered, summary });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
