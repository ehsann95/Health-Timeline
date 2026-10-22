import { NextResponse } from "next/server";
import { getPrisma, getSampleReports } from "@/lib/prisma";
import { buildSummary } from "@/lib/extractor";
import { getSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const prisma = await getPrisma();
    const sessionUser = getSessionFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const action = body.action || "clear"; // "clear" | "demo"

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

    // Delete reports only for this user/guest scope
    const existingReports = await prisma.report.findMany({
      where: whereClause,
      select: { id: true },
    });
    const ids = existingReports.map((r) => r.id);

    if (ids.length > 0) {
      await prisma.test.deleteMany({
        where: { reportId: { in: ids } },
      });
      await prisma.report.deleteMany({
        where: { id: { in: ids } },
      });
    }

    // If explicit "demo" action requested, seed demo sample reports
    if (action === "demo") {
      const samples = getSampleReports();
      const createdReports = [];

      for (const r of samples) {
        const created = await prisma.report.create({
          data: {
            patientName: r.patientName,
            reportType: r.reportType,
            labName: r.labName,
            reportDate: r.reportDate,
            userId,
            userEmail,
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
        message: "Sample demo reports loaded",
        reports: createdReports,
      });
    }

    // Default "clear" action: return 0 reports
    return NextResponse.json({
      ok: true,
      message: "All reports successfully cleared",
      reports: [],
    });
  } catch (e) {
    console.error("Reset API error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
