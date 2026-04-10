import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/matrix — traceability matrix data (Epic → Story → TC → Bug)
export async function GET() {
  try {
    const epics = await prisma.epic.findMany({
      include: {
        userStories: {
          include: {
            testCases: {
              include: {
                defectLinks: {
                  include: {
                    bug: {
                      select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true },
                    },
                  },
                },
                storySection: { select: { id: true, sectionTitle: true } },
              },
              orderBy: { createdAt: "asc" },
            },
            linkedBugs: {
              select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true },
            },
            sections: {
              select: { id: true, sectionTitle: true },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Also get orphan stories (no epic)
    const orphanStories = await prisma.userStory.findMany({
      where: { epicId: null },
      include: {
        testCases: {
          include: {
            defectLinks: {
              include: {
                bug: {
                  select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true },
                },
              },
            },
            storySection: { select: { id: true, sectionTitle: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        linkedBugs: {
          select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true },
        },
        sections: {
          select: { id: true, sectionTitle: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ epics, orphanStories });
  } catch (error) {
    console.error("GET /api/matrix error:", error);
    return NextResponse.json({ error: "Failed to fetch matrix" }, { status: 500 });
  }
}
