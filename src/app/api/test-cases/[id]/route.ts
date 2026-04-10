import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/test-cases/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tc = await prisma.testCase.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            id: true, storyId: true, storyTitle: true,
            epic: { select: { id: true, epicId: true, epicTitle: true } },
          },
        },
        storySection: { select: { id: true, sectionTitle: true } },
        reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } },
        defectLinks: {
          include: {
            bug: { select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true } },
          },
        },
      },
    });
    if (!tc) return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    return NextResponse.json(tc);
  } catch (error) {
    console.error("GET /api/test-cases/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch test case" }, { status: 500 });
  }
}

// PATCH /api/test-cases/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const fields = [
      "testCaseTitle", "storyId", "storySectionId", "requirementRef",
      "testLevel", "testType", "scenarioClassification", "priority",
      "automationStatus", "reviewerId", "testDataReference",
      "executionCycle", "executionStatus", "requirementCoverage",
      "comments", "customFields",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }

    const tc = await prisma.testCase.update({
      where: { id },
      data: updateData,
      include: {
        story: { select: { id: true, storyId: true, storyTitle: true } },
        storySection: { select: { id: true, sectionTitle: true } },
        reviewer: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    return NextResponse.json(tc);
  } catch (error) {
    console.error("PATCH /api/test-cases/[id] error:", error);
    return NextResponse.json({ error: "Failed to update test case" }, { status: 500 });
  }
}

// DELETE /api/test-cases/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.testCase.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/test-cases/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete test case" }, { status: 500 });
  }
}
