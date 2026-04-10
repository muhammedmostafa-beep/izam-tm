import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/activity — list audit logs
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") || "";
    const action = url.searchParams.get("action") || "";
    const userId = url.searchParams.get("userId") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET activity error:", error);
    return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 });
  }
}

// POST /api/admin/activity — create an audit log entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const log = await prisma.auditLog.create({
      data: {
        userId: body.userId || null,
        entityType: body.entityType,
        entityId: body.entityId,
        action: body.action,
        fieldName: body.fieldName || null,
        oldValue: body.oldValue || null,
        newValue: body.newValue || null,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("POST activity error:", error);
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}
