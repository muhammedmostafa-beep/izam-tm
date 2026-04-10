import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/import-export?type=epics|stories|test-cases|bugs — export data as JSON
export async function GET(req: NextRequest) {
  try {
    const type = new URL(req.url).searchParams.get("type") || "all";

    const result: Record<string, unknown[]> = {};

    if (type === "all" || type === "epics") {
      result.epics = await prisma.epic.findMany({
        include: { owner: { select: { name: true, email: true } } },
      });
    }
    if (type === "all" || type === "stories") {
      result.stories = await prisma.userStory.findMany({
        include: {
          epic: { select: { epicId: true } },
          owner: { select: { name: true, email: true } },
          sections: { orderBy: { sortOrder: "asc" } },
        },
      });
    }
    if (type === "all" || type === "test-cases") {
      result.testCases = await prisma.testCase.findMany({
        include: {
          story: { select: { storyId: true } },
          storySection: { select: { sectionTitle: true } },
          reviewer: { select: { name: true, email: true } },
        },
      });
    }
    if (type === "all" || type === "bugs") {
      result.bugs = await prisma.productionBug.findMany({
        include: {
          reportedBy: { select: { name: true, email: true } },
          linkedEpic: { select: { epicId: true } },
          linkedStory: { select: { storyId: true } },
        },
      });
    }

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      type,
      data: result,
    });
  } catch (error) {
    console.error("GET export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

// POST /api/admin/import-export — import data (simplified)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const results = { epics: 0, stories: 0, testCases: 0, bugs: 0 };

    if (body.epics && Array.isArray(body.epics)) {
      for (const epic of body.epics) {
        await prisma.epic.upsert({
          where: { epicId: epic.epicId },
          update: { epicTitle: epic.epicTitle },
          create: { epicId: epic.epicId, epicTitle: epic.epicTitle },
        });
        results.epics++;
      }
    }

    if (body.stories && Array.isArray(body.stories)) {
      for (const story of body.stories) {
        await prisma.userStory.upsert({
          where: { storyId: story.storyId },
          update: { storyTitle: story.storyTitle },
          create: { storyId: story.storyId, storyTitle: story.storyTitle },
        });
        results.stories++;
      }
    }

    if (body.testCases && Array.isArray(body.testCases)) {
      for (const tc of body.testCases) {
        await prisma.testCase.upsert({
          where: { testCaseId: tc.testCaseId },
          update: { testCaseTitle: tc.testCaseTitle },
          create: { testCaseId: tc.testCaseId, testCaseTitle: tc.testCaseTitle },
        });
        results.testCases++;
      }
    }

    if (body.bugs && Array.isArray(body.bugs)) {
      for (const bug of body.bugs) {
        await prisma.productionBug.upsert({
          where: { bugId: bug.bugId },
          update: { bugTitle: bug.bugTitle },
          create: { bugId: bug.bugId, bugTitle: bug.bugTitle },
        });
        results.bugs++;
      }
    }

    return NextResponse.json({ success: true, imported: results });
  } catch (error) {
    console.error("POST import error:", error);
    return NextResponse.json({ error: "Failed to import" }, { status: 500 });
  }
}
