import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getPrisma, getSampleReports } from "@/lib/prisma";
import { buildSummary } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = getSessionFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in first." }, { status: 401 });
    }

    const prisma = await getPrisma();
    const body = await request.json().catch(() => ({}));
    const guestReports = Array.isArray(body.reports) ? body.reports : [];

    // Fetch all current reports for this user
    const userReportsWhere = {
      OR: [
        { userId: user.id },
        { userEmail: user.email },
      ],
    };

    const existingUserReports = await prisma.report.findMany({
      where: userReportsWhere,
      include: { tests: true },
    });

    const isDuplicate = (r) => {
      return existingUserReports.some((e) => {
        if (r.id && e.id === r.id) return true;
        const sameType =
          (e.reportType || "").trim().toLowerCase() ===
          (r.reportType || "").trim().toLowerCase();
        const sameLab =
          (e.labName || "").trim().toLowerCase() ===
          (r.labName || "").trim().toLowerCase();
        const eDate = e.reportDate
          ? new Date(e.reportDate).toISOString().slice(0, 10)
          : "";
        const rDate = r.reportDate
          ? new Date(r.reportDate).toISOString().slice(0, 10)
          : "";
        const sameDate = eDate && rDate && eDate === rDate;
        return sameType && sameLab && sameDate;
      });
    };

    let claimedCount = 0;

    for (const r of guestReports) {
      if (!r || !r.reportType) continue;

      // Skip duplicates of existing user reports
      if (isDuplicate(r)) {
        continue;
      }

      // Check if report already exists in DB as an unassigned guest report
      let existingInDb = null;
      if (r.id) {
        existingInDb = await prisma.report.findUnique({
          where: { id: r.id },
          include: { tests: true },
        });
      }

      if (existingInDb) {
        // If it was unassigned (or belongs to no one else), claim it for this user
        await prisma.report.update({
          where: { id: existingInDb.id },
          data: {
            userId: user.id,
            userEmail: user.email,
          },
        });
        claimedCount++;
      } else {
        // Create new record for this user
        const testsData = (r.tests || []).map((t) => ({
          name: t.name,
          category: t.category || "Other",
          value: parseFloat(t.value) || 0,
          unit: t.unit || null,
          refLow: t.refLow != null ? parseFloat(t.refLow) : null,
          refHigh: t.refHigh != null ? parseFloat(t.refHigh) : null,
          flag: t.flag || "NORMAL",
          verified: Boolean(t.verified),
        }));

        await prisma.report.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            patientName: r.patientName || "Self",
            reportType: r.reportType,
            labName: r.labName || null,
            reportDate: r.reportDate ? new Date(r.reportDate) : new Date(),
            rawText: r.rawText || null,
            tests: { create: testsData },
          },
        });
        claimedCount++;
      }
    }

    // Refresh and fetch all reports for this user
    let allUserReports = await prisma.report.findMany({
      where: userReportsWhere,
      include: { tests: true },
      orderBy: { reportDate: "desc" },
    });

    // If user still has 0 reports (fresh account with no reports), seed standard demo reports
    if (allUserReports.length === 0) {
      for (const sample of getSampleReports()) {
        await prisma.report.create({
          data: {
            ...sample,
            userId: user.id,
            userEmail: user.email,
            tests: { create: sample.tests },
          },
        });
      }
      allUserReports = await prisma.report.findMany({
        where: userReportsWhere,
        include: { tests: true },
        orderBy: { reportDate: "desc" },
      });
    }

    const reportsWithSummary = allUserReports.map((r) => ({
      ...r,
      summary: buildSummary(r.tests || []),
    }));

    return NextResponse.json({
      ok: true,
      claimedCount,
      reports: reportsWithSummary,
    });
  } catch (err) {
    console.error("Failed to claim reports:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
