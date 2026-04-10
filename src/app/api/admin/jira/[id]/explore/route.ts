import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  testJiraConnection,
  getJiraProjects,
  getJiraBoards,
  getJiraSprints,
} from "@/lib/jira";

// POST /api/admin/jira/[id]/explore — test connection OR fetch projects/boards/sprints
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, email, apiToken, projectKey, boardId, sprintState } = body;

    // Fetch stored config to get site URL
    const config = await prisma.jiraConfig.findUnique({ where: { id } });
    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const siteUrl = config.jiraSiteUrl;

    switch (action) {
      case "test": {
        const result = await testJiraConnection(siteUrl, email, apiToken);
        return NextResponse.json(result);
      }

      case "projects": {
        const query = body.query || "";
        const projects = await getJiraProjects(siteUrl, email, apiToken, query);
        return NextResponse.json({ projects });
      }

      case "boards": {
        const boards = await getJiraBoards(siteUrl, email, apiToken, projectKey);
        return NextResponse.json({ boards });
      }

      case "sprints": {
        if (!boardId) {
          return NextResponse.json({ error: "boardId required" }, { status: 400 });
        }
        const sprints = await getJiraSprints(
          siteUrl, email, apiToken, boardId, sprintState
        );
        return NextResponse.json({ sprints });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("POST /api/admin/jira/[id]/explore error:", error);
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
