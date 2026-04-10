import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/epics — list all epics with stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where = search
      ? {
          OR: [
            { epicId: { contains: search, mode: "insensitive" as const } },
            { epicTitle: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [epics, total] = await Promise.all([
      prisma.epic.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: {
            select: {
              userStories: true,
              linkedBugs: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.epic.count({ where }),
    ]);

    // Enrich with coverage stats
    const enrichedEpics = await Promise.all(
      epics.map(async (epic) => {
        const stories = await prisma.userStory.findMany({
          where: { epicId: epic.id },
          select: { id: true },
        });

        const storyIds = stories.map((s) => s.id);

        const testCaseCount = storyIds.length > 0
          ? await prisma.testCase.count({
              where: { storyId: { in: storyIds } },
            })
          : 0;

        const storiesWithTests = storyIds.length > 0
          ? await prisma.testCase.groupBy({
              by: ["storyId"],
              where: { storyId: { in: storyIds } },
            })
          : [];

        return {
          ...epic,
          stats: {
            stories: epic._count.userStories,
            testCases: testCaseCount,
            bugs: epic._count.linkedBugs,
            storiesWithCoverage: storiesWithTests.length,
            coveragePct:
              stories.length > 0
                ? Math.round((storiesWithTests.length / stories.length) * 100)
                : 0,
          },
        };
      })
    );

    return NextResponse.json({
      data: enrichedEpics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/epics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch epics" },
      { status: 500 }
    );
  }
}

// POST /api/epics — create new epic
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { epicTitle, ownerId, customFields } = body;

    // Auto-generate epic ID
    const lastEpic = await prisma.epic.findFirst({
      orderBy: { createdAt: "desc" },
      select: { epicId: true },
    });

    let nextNum = 1;
    if (lastEpic?.epicId) {
      const match = lastEpic.epicId.match(/EPIC-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const epicId = `EPIC-${String(nextNum).padStart(3, "0")}`;

    const epic = await prisma.epic.create({
      data: {
        epicId,
        epicTitle,
        ownerId: ownerId || null,
        customFields: customFields || {},
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(epic, { status: 201 });
  } catch (error) {
    console.error("POST /api/epics error:", error);
    return NextResponse.json(
      { error: "Failed to create epic" },
      { status: 500 }
    );
  }
}
