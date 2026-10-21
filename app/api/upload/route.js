import { NextResponse } from "next/server";
import { extractText, parseTests, buildSummary, detectReportType } from "@/lib/extractor";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const prisma = await getPrisma();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const labName = formData.get("labName")?.toString().trim();
    if (!labName) {
      return NextResponse.json({ error: "Lab name is required" }, { status: 400 });
    }

    const rawDate = formData.get("reportDate");
    if (!rawDate) {
      return NextResponse.json({ error: "Report date is required" }, { status: 400 });
    }
    const reportDate = new Date(rawDate);
    if (isNaN(reportDate.getTime())) {
      return NextResponse.json({ error: "Invalid report date format" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extraction = { text: "", method: "failed" };
    try {
      extraction = await extractText(
        buffer,
        file.type || "",
        file.name || ""
      );
    } catch (e) {
      return NextResponse.json(
        { error: `Extraction failed: ${e.message}`, parsedTests: [] },
        { status: 422 }
      );
    }

    const parsedTests = parseTests(extraction.text);

    const requestedType = formData.get("reportType");
    const reportType = detectReportType(parsedTests, requestedType);

    const report = await prisma.report.create({
      data: {
        patientName: formData.get("patientName") || "Self",
        reportType,
        labName,
        reportDate,
        rawText: extraction.text,
        tests: { create: parsedTests },
      },
      include: { tests: true },
    });

    const reportWithSummary = {
      ...report,
      summary: buildSummary(report.tests || []),
    };

    return NextResponse.json({
      report: reportWithSummary,
      extractionMethod: extraction.method,
      parsedCount: parsedTests.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
