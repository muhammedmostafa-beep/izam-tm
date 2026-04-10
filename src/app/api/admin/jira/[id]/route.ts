import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/jira/[id] — update config
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.jiraSiteUrl !== undefined) updateData.jiraSiteUrl = body.jiraSiteUrl;
    if (body.syncIntervalMinutes !== undefined) updateData.syncIntervalMinutes = body.syncIntervalMinutes;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const config = await prisma.jiraConfig.update({
      where: { id },
      data: updateData,
      include: { configuredBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(config);
  } catch (error) {
    console.error("PATCH /api/admin/jira/[id] error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}

// DELETE /api/admin/jira/[id] — delete config
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.jiraConfig.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/jira/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
