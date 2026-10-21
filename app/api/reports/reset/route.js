import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { buildSummary } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSampleReports() {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000);
  return [
    {
      patientName: "Self",
      reportType: "CBC",
      labName: "CityLab Diagnostics",
      reportDate: daysAgo(180),
      tests: [
        { name: "Hemoglobin", category: "CBC", value: 13.2, unit: "g/dL", refLow: 13, refHigh: 17, flag: "NORMAL" },
        { name: "WBC", category: "CBC", value: 7200, unit: "/µL", refLow: 4000, refHigh: 11000, flag: "NORMAL" },
        { name: "Platelets", category: "CBC", value: 145000, unit: "/µL", refLow: 150000, refHigh: 450000, flag: "LOW" },
        { name: "RBC", category: "CBC", value: 4.4, unit: "mill/cumm", refLow: 4.5, refHigh: 5.5, flag: "LOW" },
      ],
    },
    {
      patientName: "Self",
      reportType: "LFT",
      labName: "CityLab Diagnostics",
      reportDate: daysAgo(90),
      tests: [
        { name: "ALT (SGPT)", category: "LFT", value: 62, unit: "U/L", refLow: 7, refHigh: 56, flag: "HIGH" },
        { name: "AST (SGOT)", category: "LFT", value: 48, unit: "U/L", refLow: 10, refHigh: 40, flag: "HIGH" },
        { name: "Bilirubin Total", category: "LFT", value: 1.1, unit: "mg/dL", refLow: 0.3, refHigh: 1.2, flag: "NORMAL" },
      ],
    },
    {
      patientName: "Self",
      reportType: "LFT + CBC",
      labName: "Metro Health Labs",
      reportDate: daysAgo(10),
      tests: [
        { name: "ALT (SGPT)", category: "LFT", value: 71, unit: "U/L", refLow: 7, refHigh: 56, flag: "HIGH" },
        { name: "AST (SGOT)", category: "LFT", value: 39, unit: "U/L", refLow: 10, refHigh: 40, flag: "NORMAL" },
        { name: "Bilirubin Total", category: "LFT", value: 0.9, unit: "mg/dL", refLow: 0.3, refHigh: 1.2, flag: "NORMAL" },
        { name: "Hemoglobin", category: "CBC", value: 14.1, unit: "g/dL", refLow: 13, refHigh: 17, flag: "NORMAL" },
      ],
    },
  ];
}

export async function POST() {
  try {
    const prisma = await getPrisma();

    // Clear existing tests and reports
    await prisma.test.deleteMany();
    await prisma.report.deleteMany();

    // Re-seed initial clean demo sample reports
    const samples = getSampleReports();
    const createdReports = [];

    for (const r of samples) {
      const created = await prisma.report.create({
        data: {
          patientName: r.patientName,
          reportType: r.reportType,
          labName: r.labName,
          reportDate: r.reportDate,
          tests: { create: r.tests },
        },
        include: { tests: true },
      });
      createdReports.push({
        ...created,
        summary: buildSummary(created.tests || []),
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Database successfully reset to demo sample reports",
      reports: createdReports,
    });
  } catch (e) {
    console.error("Reset API error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

