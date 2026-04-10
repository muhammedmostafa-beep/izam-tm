import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/bugs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const severity = searchParams.get("severity");
    const bugStatus = searchParams.get("bugStatus");
    const environment = searchParams.get("environment");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { bugId: { contains: search, mode: "insensitive" } },
        { bugTitle: { contains: search, mode: "insensitive" } },
      ];
    }
    if (severity) where.severity = severity;
    if (bugStatus) where.bugStatus = bugStatus;
    if (environment) where.environment = environment;

    const [bugs, total] = await Promise.all([
      prisma.productionBug.findMany({
        where,
        include: {
          reportedBy: { select: { id: true, name: true, avatarUrl: true } },
          linkedEpic: { select: { id: true, epicId: true, epicTitle: true } },
          linkedStory: { select: { id: true, storyId: true, storyTitle: true } },
          _count: { select: { defectLinks: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productionBug.count({ where }),
    ]);

    return NextResponse.json({
      data: bugs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/bugs error:", error);
    return NextResponse.json({ error: "Failed to fetch bugs" }, { status: 500 });
  }
}

// POST /api/bugs
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const lastBug = await prisma.productionBug.findFirst({
      orderBy: { createdAt: "desc" },
      select: { bugId: true },
    });
    let nextNum = 1;
    if (lastBug?.bugId) {
      const match = lastBug.bugId.match(/BUG-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const bugId = `BUG-${String(nextNum).padStart(4, "0")}`;

    const bug = await prisma.productionBug.create({
      data: {
        bugId,
        bugTitle: body.bugTitle,
        reportedDate: body.reportedDate ? new Date(body.reportedDate) : new Date(),
        reportedById: body.reportedById || null,
        severity: body.severity || null,
        priority: body.priority || null,
        environment: body.environment || null,
        linkedEpicId: body.linkedEpicId || null,
        linkedStoryId: body.linkedStoryId || null,
        releaseVersion: body.releaseVersion || null,
        defectLeakagePhase: body.defectLeakagePhase || null,
        rootCauseCategory: body.rootCauseCategory || null,
        requirementGap: body.requirementGap || false,
        testCoverageGap: body.testCoverageGap || false,
        existingTestCaseId: body.existingTestCaseId || null,
        newTestCaseNeeded: body.newTestCaseNeeded || false,
        rcaSummary: body.rcaSummary || null,
        preventiveAction: body.preventiveAction || null,
        regressionPackUpdated: body.regressionPackUpdated || false,
        bugStatus: body.bugStatus || "Open",
        customFields: body.customFields || {},
      },
      include: {
        reportedBy: { select: { id: true, name: true, avatarUrl: true } },
        linkedEpic: { select: { id: true, epicId: true, epicTitle: true } },
        linkedStory: { select: { id: true, storyId: true, storyTitle: true } },
      },
    });

    return NextResponse.json(bug, { status: 201 });
  } catch (error) {
    console.error("POST /api/bugs error:", error);
    return NextResponse.json({ error: "Failed to create bug" }, { status: 500 });
  }
}
