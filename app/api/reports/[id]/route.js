import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { buildSummary, detectReportType } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  try {
    const prisma = await getPrisma();
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await request.json();

    if (body.tests && Array.isArray(body.tests)) {
      const existingTests = await prisma.test.findMany({
        where: { reportId: id },
      });
      const existingIdSet = new Set(existingTests.map((e) => e.id));
      const keptIds = new Set();

      for (const t of body.tests) {
        if (!t || !t.name) continue;
        const val = typeof t.value === "number" ? t.value : parseFloat(t.value) || 0;
        const low = t.refLow === "" || t.refLow == null ? null : parseFloat(t.refLow);
        const high = t.refHigh === "" || t.refHigh == null ? null : parseFloat(t.refHigh);

        if (t.id && existingIdSet.has(t.id)) {
          // Update existing test
          await prisma.test.update({
            where: { id: t.id },
            data: {
              name: t.name,
              category: t.category || "Other",
              value: val,
              unit: t.unit || null,
              refLow: low,
              refHigh: high,
              flag: t.flag || "NORMAL",
              verified: true,
            },
          });
          keptIds.add(t.id);
        } else {
          // Create new test (including rows added on client with temp_ ids)
          const created = await prisma.test.create({
            data: {
              reportId: id,
              name: t.name,
              category: t.category || "Other",
              value: val,
              unit: t.unit || null,
              refLow: low,
              refHigh: high,
              flag: t.flag || "NORMAL",
              verified: true,
            },
          });
          keptIds.add(created.id);
        }
      }

      // Delete any tests removed during edit
      const toDeleteIds = existingTests.filter((e) => !keptIds.has(e.id)).map((e) => e.id);
      if (toDeleteIds.length > 0) {
        await prisma.test.deleteMany({
          where: { id: { in: toDeleteIds } },
        });
      }
    }

    const data = {};
    if (body.reportDate) {
      const d = new Date(body.reportDate);
      if (!isNaN(d.getTime())) data.reportDate = d;
    }
    if (body.reportType) data.reportType = body.reportType;
    if (body.labName !== undefined) data.labName = body.labName;
    if (body.patientName) data.patientName = body.patientName;
    if (Object.keys(data).length) {
      await prisma.report.update({ where: { id }, data });
    }

    const updated = await prisma.report.findUnique({
      where: { id },
      include: { tests: true },
    });

    if (!updated) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Auto-update reportType if tests now span multiple panels and reportType was not manually overridden
    let finalReportType = updated.reportType;
    if (!body.reportType && updated.tests?.length) {
      finalReportType = detectReportType(updated.tests, updated.reportType);
      if (finalReportType !== updated.reportType) {
        await prisma.report.update({
          where: { id },
          data: { reportType: finalReportType },
        });
      }
    }

    const reportWithSummary = {
      ...updated,
      reportType: finalReportType,
      summary: buildSummary(updated.tests || []),
    };

    return NextResponse.json({ report: reportWithSummary });
  } catch (e) {
    console.error("PUT /api/reports/[id] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const prisma = await getPrisma();
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    await prisma.test.deleteMany({ where: { reportId: id } });
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
