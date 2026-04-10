import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/coverage — coverage summary per epic
export async function GET() {
  try {
    const epics = await prisma.epic.findMany({
      include: {
        userStories: {
          include: {
            testCases: {
              select: { id: true, scenarioClassification: true, executionStatus: true },
            },
          },
        },
        linkedBugs: {
          select: { id: true, bugStatus: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const summary = epics.map((epic) => {
      const stories = epic.userStories;
      const allTCs = stories.flatMap((s) => s.testCases);
      const storiesWithTC = stories.filter((s) => s.testCases.length > 0);

      const happyTCs = allTCs.filter((tc) => tc.scenarioClassification === "Happy");
      const negativeTCs = allTCs.filter((tc) => tc.scenarioClassification === "Negative");
      const edgeTCs = allTCs.filter((tc) => tc.scenarioClassification === "Edge");

      const totalScenarios = Math.max(stories.length, 1);

      return {
        epicId: epic.epicId,
        epicTitle: epic.epicTitle,
        totalStories: stories.length,
        storiesWithCoverage: storiesWithTC.length,
        totalTestCases: allTCs.length,
        happyCoveragePct: stories.length > 0
          ? Math.round((happyTCs.length / totalScenarios) * 100) : 0,
        negativeCoveragePct: stories.length > 0
          ? Math.round((negativeTCs.length / totalScenarios) * 100) : 0,
        edgeCoveragePct: stories.length > 0
          ? Math.round((edgeTCs.length / totalScenarios) * 100) : 0,
        overallCoveragePct: stories.length > 0
          ? Math.round((storiesWithTC.length / stories.length) * 100) : 0,
        openBugs: epic.linkedBugs.filter((b) => b.bugStatus === "Open" || b.bugStatus === "In Progress").length,
        closedBugs: epic.linkedBugs.filter((b) => b.bugStatus === "Closed").length,
        passRate: allTCs.length > 0
          ? Math.round((allTCs.filter((tc) => tc.executionStatus === "Passed").length / allTCs.length) * 100) : 0,
      };
    });

    // Global totals
    const totals = {
      totalEpics: summary.length,
      totalStories: summary.reduce((s, e) => s + e.totalStories, 0),
      totalTestCases: summary.reduce((s, e) => s + e.totalTestCases, 0),
      overallCoverage: summary.length > 0
        ? Math.round(summary.reduce((s, e) => s + e.overallCoveragePct, 0) / summary.length) : 0,
      totalOpenBugs: summary.reduce((s, e) => s + e.openBugs, 0),
      avgPassRate: summary.length > 0
        ? Math.round(summary.reduce((s, e) => s + e.passRate, 0) / summary.length) : 0,
    };

    return NextResponse.json({ summary, totals });
  } catch (error) {
    console.error("GET /api/coverage error:", error);
    return NextResponse.json({ error: "Failed to fetch coverage" }, { status: 500 });
  }
}
