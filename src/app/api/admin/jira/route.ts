import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/jira — list Jira configs
export async function GET() {
  try {
    const configs = await prisma.jiraConfig.findMany({
      include: {
        configuredBy: { select: { id: true, name: true, email: true } },
        projectMappings: {
          include: { tmEpic: { select: { id: true, epicId: true, epicTitle: true } } },
        },
        _count: { select: { syncLogs: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("GET /api/admin/jira error:", error);
    return NextResponse.json({ error: "Failed to fetch Jira configs" }, { status: 500 });
  }
}

// POST /api/admin/jira — create Jira config
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    // Use session user or fallback
    const userId = session?.user?.id || body.configuredById;

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const config = await prisma.jiraConfig.create({
      data: {
        jiraSiteUrl: body.jiraSiteUrl,
        oauthTokenEncrypted: body.apiToken || null, // Best practice is encryption, storing plain for now
        refreshTokenEncrypted: body.email || null, // Storing email in refresh token field
        configuredById: userId,
        syncIntervalMinutes: body.syncIntervalMinutes || 15,
        isActive: true,
      },
      include: {
        configuredBy: { select: { id: true, name: true, email: true } },
        projectMappings: true,
        _count: { select: { syncLogs: true } },
      },
    });
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/jira error:", error);
    return NextResponse.json({ error: "Failed to create Jira config" }, { status: 500 });
  }
}
