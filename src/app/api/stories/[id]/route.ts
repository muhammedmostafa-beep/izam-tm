import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/stories/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const story = await prisma.userStory.findUnique({
      where: { id },
      include: {
        epic: { select: { id: true, epicId: true, epicTitle: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        requester: { select: { id: true, name: true, email: true } },
        sections: { orderBy: { sortOrder: "asc" } },
        testCases: {
          include: {
            reviewer: { select: { id: true, name: true } },
            storySection: { select: { id: true, sectionTitle: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        linkedBugs: {
          select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    return NextResponse.json(story);
  } catch (error) {
    console.error("GET /api/stories/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch story" }, { status: 500 });
  }
}

// PATCH /api/stories/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    const fields = [
      "storyTitle", "epicId", "requesterId", "reasonForRequest",
      "businessPriority", "changeType", "businessImpact", "riskLevel",
      "moduleFeature", "implementationSprint", "releaseVersion",
      "storyStatus", "qcStatus", "ownerId", "notes", "customFields",
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }

    // Handle date fields separately
    if (body.sprintStartDate !== undefined) {
      updateData.sprintStartDate = body.sprintStartDate ? new Date(body.sprintStartDate) : null;
    }
    if (body.sprintEndDate !== undefined) {
      updateData.sprintEndDate = body.sprintEndDate ? new Date(body.sprintEndDate) : null;
    }
    if (body.deploymentDate !== undefined) {
      updateData.deploymentDate = body.deploymentDate ? new Date(body.deploymentDate) : null;
    }

    const story = await prisma.userStory.update({
      where: { id },
      data: updateData,
      include: {
        epic: { select: { id: true, epicId: true, epicTitle: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(story);
  } catch (error) {
    console.error("PATCH /api/stories/[id] error:", error);
    return NextResponse.json({ error: "Failed to update story" }, { status: 500 });
  }
}

// DELETE /api/stories/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.userStory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/stories/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete story" }, { status: 500 });
  }
}
