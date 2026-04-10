import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/bugs/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bug = await prisma.productionBug.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        linkedEpic: { select: { id: true, epicId: true, epicTitle: true } },
        linkedStory: { select: { id: true, storyId: true, storyTitle: true } },
        existingTestCase: { select: { id: true, testCaseId: true, testCaseTitle: true } },
        defectLinks: {
          include: {
            testCase: { select: { id: true, testCaseId: true, testCaseTitle: true } },
          },
        },
      },
    });
    if (!bug) return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    return NextResponse.json(bug);
  } catch (error) {
    console.error("GET /api/bugs/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch bug" }, { status: 500 });
  }
}

// PATCH /api/bugs/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    const stringFields = [
      "bugTitle", "severity", "priority", "environment",
      "linkedEpicId", "linkedStoryId", "releaseVersion",
      "defectLeakagePhase", "rootCauseCategory",
      "existingTestCaseId", "rcaSummary", "preventiveAction",
      "bugStatus", "customFields",
    ];
    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field] || null;
    }
    const booleanFields = ["requirementGap", "testCoverageGap", "newTestCaseNeeded", "regressionPackUpdated"];
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = Boolean(body[field]);
    }
    if (body.reportedDate !== undefined) {
      updateData.reportedDate = body.reportedDate ? new Date(body.reportedDate) : null;
    }
    if (body.reportedById !== undefined) {
      updateData.reportedById = body.reportedById || null;
    }

    const bug = await prisma.productionBug.update({
      where: { id },
      data: updateData,
      include: {
        reportedBy: { select: { id: true, name: true, avatarUrl: true } },
        linkedEpic: { select: { id: true, epicId: true, epicTitle: true } },
        linkedStory: { select: { id: true, storyId: true, storyTitle: true } },
      },
    });
    return NextResponse.json(bug);
  } catch (error) {
    console.error("PATCH /api/bugs/[id] error:", error);
    return NextResponse.json({ error: "Failed to update bug" }, { status: 500 });
  }
}

// DELETE /api/bugs/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.productionBug.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/bugs/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete bug" }, { status: 500 });
  }
}
