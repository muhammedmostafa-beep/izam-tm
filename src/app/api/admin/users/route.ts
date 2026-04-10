import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/users — list all users with roles
export async function GET(req: NextRequest) {
  try {
    const search = new URL(req.url).searchParams.get("search") || "";
    const roleId = new URL(req.url).searchParams.get("roleId") || "";
    const status = new URL(req.url).searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (roleId) where.roleId = roleId;
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, title: true,
        avatarUrl: true, isActive: true, createdAt: true,
        role: { select: { id: true, name: true, permissions: true } },
        _count: {
          select: {
            ownedEpics: true, ownedStories: true,
            reviewedTestCases: true, reportedBugs: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/admin/users — create a user (manual)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email || !body.name) {
      return NextResponse.json({ error: "Email and name required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        title: body.title || null,
        roleId: body.roleId || null,
        isActive: true,
      },
      include: { role: { select: { id: true, name: true } } },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
