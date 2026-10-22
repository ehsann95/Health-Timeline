import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { buildSummary } from "@/lib/extractor";
import { getSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const prisma = await getPrisma();
    const sessionUser = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const clientReports = Array.isArray(body.reports) ? body.reports : [];
    const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];

    let whereClause = {};
    let userId = null;
    let userEmail = null;

    if (sessionUser) {
      whereClause = {
        OR: [
          { userId: sessionUser.id },
          { userEmail: sessionUser.email },
        ],
      };
      userId = sessionUser.id;
      userEmail = sessionUser.email;
    } else {
      whereClause = { userId: null };
    }

    // 1. Process explicit deletions
    if (deletedIds.length > 0) {
      const existingToDelete = await prisma.report.findMany({
        where: {
          id: { in: deletedIds },
          ...whereClause,
        },
        select: { id: true },
      });
      const delIds = existingToDelete.map((r) => r.id);
      if (delIds.length > 0) {
        await prisma.test.deleteMany({ where: { reportId: { in: delIds } } });
        await prisma.report.deleteMany({ where: { id: { in: delIds } } });
      }
    }

    // 2. Query existing reports currently in this database instance
    const existing = await prisma.report.findMany({
      where: whereClause,
      include: { tests: true },
    });
    const existingIds = new Set(existing.map((r) => r.id));

    // 3. Re-hydrate any reports present on client but missing in this serverless instance
    for (const r of clientReports) {
      if (!r || !r.id || !r.reportType) continue;
      if (deletedIds.includes(r.id)) continue;
      if (existingIds.has(r.id)) continue;

      // Check if report exists in DB with another/null ownership
      const inDb = await prisma.report.findUnique({
        where: { id: r.id },
      });

      if (inDb) {
        await prisma.report.update({
          where: { id: r.id },
          data: { userId, userEmail },
        });
      } else {
        const testsData = (r.tests || []).map((t) => ({
          name: t.name,
          category: t.category || "Other",
          value: typeof t.value === "number" ? t.value : parseFloat(t.value) || 0,
          unit: t.unit || null,
          refLow: t.refLow != null ? parseFloat(t.refLow) : null,
          refHigh: t.refHigh != null ? parseFloat(t.refHigh) : null,
          flag: t.flag || "NORMAL",
          verified: Boolean(t.verified),
        }));

        await prisma.report.create({
          data: {
            id: r.id,
            userId,
            userEmail,
            patientName: r.patientName || "Self",
            reportType: r.reportType,
            labName: r.labName || null,
            reportDate: r.reportDate ? new Date(r.reportDate) : new Date(),
            rawText: r.rawText || null,
            tests: { create: testsData },
          },
        });
      }
    }

    // 4. Return all current reports for this user/guest scope
    const allReports = await prisma.report.findMany({
      where: whereClause,
      include: { tests: true },
      orderBy: { reportDate: "desc" },
    });

    return NextResponse.json({
      ok: true,
      reports: allReports.map((r) => ({
        ...r,
        summary: buildSummary(r.tests || []),
      })),
    });
  } catch (err) {
    console.error("Sync API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

