import { NextResponse } from "next/server";
import { extractText, parseTests, buildSummary } from "@/lib/extractor";
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

    let reportDate = new Date();
    const rawDate = formData.get("reportDate");
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        reportDate = parsedDate;
      }
    }

    const report = await prisma.report.create({
      data: {
        patientName: formData.get("patientName") || "Self",
        reportType: formData.get("reportType") || "Unknown",
        labName: formData.get("labName") || null,
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
