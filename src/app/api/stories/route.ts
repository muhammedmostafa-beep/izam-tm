import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/stories — list all user stories
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const epicId = searchParams.get("epicId");
    const status = searchParams.get("status");
    const qcStatus = searchParams.get("qcStatus");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { storyId: { contains: search, mode: "insensitive" } },
        { storyTitle: { contains: search, mode: "insensitive" } },
        { moduleFeature: { contains: search, mode: "insensitive" } },
      ];
    }
    if (epicId) where.epicId = epicId;
    if (status) where.storyStatus = status;
    if (qcStatus) where.qcStatus = qcStatus;

    const [stories, total] = await Promise.all([
      prisma.userStory.findMany({
        where,
        include: {
          epic: { select: { id: true, epicId: true, epicTitle: true } },
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          requester: { select: { id: true, name: true } },
          _count: {
            select: {
              testCases: true,
              sections: true,
              linkedBugs: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userStory.count({ where }),
    ]);

    return NextResponse.json({
      data: stories,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/stories error:", error);
    return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
  }
}

// POST /api/stories — create user story
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Auto-generate story ID
    const lastStory = await prisma.userStory.findFirst({
      orderBy: { createdAt: "desc" },
      select: { storyId: true },
    });

    let nextNum = 1;
    if (lastStory?.storyId) {
      const match = lastStory.storyId.match(/US-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const storyId = `US-${String(nextNum).padStart(4, "0")}`;

    const story = await prisma.userStory.create({
      data: {
        storyId,
        storyTitle: body.storyTitle,
        epicId: body.epicId || null,
        requesterId: body.requesterId || null,
        reasonForRequest: body.reasonForRequest || null,
        businessPriority: body.businessPriority || null,
        changeType: body.changeType || null,
        businessImpact: body.businessImpact || null,
        riskLevel: body.riskLevel || null,
        moduleFeature: body.moduleFeature || null,
        implementationSprint: body.implementationSprint || null,
        sprintStartDate: body.sprintStartDate ? new Date(body.sprintStartDate) : null,
        sprintEndDate: body.sprintEndDate ? new Date(body.sprintEndDate) : null,
        releaseVersion: body.releaseVersion || null,
        deploymentDate: body.deploymentDate ? new Date(body.deploymentDate) : null,
        storyStatus: body.storyStatus || "Backlog",
        qcStatus: body.qcStatus || "Not Started",
        ownerId: body.ownerId || null,
        notes: body.notes || null,
        customFields: body.customFields || {},
      },
      include: {
        epic: { select: { id: true, epicId: true, epicTitle: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(story, { status: 201 });
  } catch (error) {
    console.error("POST /api/stories error:", error);
    return NextResponse.json({ error: "Failed to create story" }, { status: 500 });
  }
}
