import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { extractText, parseTests } from "@/lib/extractor";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
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

    const report = await prisma.report.create({
      data: {
        patientName: formData.get("patientName") || "Self",
        reportType: formData.get("reportType") || "Unknown",
        labName: formData.get("labName") || null,
        reportDate: formData.get("reportDate")
          ? new Date(formData.get("reportDate"))
          : new Date(),
        rawText: extraction.text,
        tests: { create: parsedTests },
      },
      include: { tests: true },
    });

    return NextResponse.json({
      report,
      extractionMethod: extraction.method,
      parsedCount: parsedTests.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
