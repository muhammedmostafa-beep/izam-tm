import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/jira/[id]/mappings — Create a Jira project mapping
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await req.json();

    const { jiraProjectKey, jiraProjectName, targetEpicId, createNewEpic } = body;

    if (!jiraProjectKey) {
      return NextResponse.json({ error: "jiraProjectKey is required" }, { status: 400 });
    }

    let tmEpicId = targetEpicId;

    // Create a new Epic container if requested
    if (createNewEpic) {
      const epic = await prisma.epic.create({
        data: {
          epicId: `EPIC-${jiraProjectKey}`,
          epicTitle: jiraProjectName || `Jira Project: ${jiraProjectKey}`,
          ownerId: session?.user?.id || undefined,
        },
      });
      tmEpicId = epic.id;
    }

    // Upsert the mapping
    const mapping = await prisma.jiraProjectMapping.create({
      data: {
        jiraConfigId: id,
        jiraProjectKey,
        jiraProjectName,
        tmEpicId,
      },
      include: {
        tmEpic: { select: { id: true, epicId: true, epicTitle: true } },
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/jira/[id]/mappings error:", error);
    // Handle unique constraint violations gracefully
    if ((error as any).code === 'P2002') {
      return NextResponse.json({ error: "This Epic ID already exists. Please choose to map to an existing Epic instead." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
