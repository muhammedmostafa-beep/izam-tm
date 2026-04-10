import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/users/[id] — update user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.title !== undefined) updateData.title = body.title || null;
    if (body.roleId !== undefined) updateData.roleId = body.roleId || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.themePref !== undefined) updateData.themePref = body.themePref;
    if (body.viewModePref !== undefined) updateData.viewModePref = body.viewModePref;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: { select: { id: true, name: true } } },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — soft-delete (deactivate)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to deactivate user" }, { status: 500 });
  }
}
