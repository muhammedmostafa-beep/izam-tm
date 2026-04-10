import { NextRequest, NextResponse } from "next/server";
import {
  testJiraConnection,
  getJiraProjects,
  getJiraBoards,
  getJiraSprints,
} from "@/lib/jira";

// POST /api/admin/jira/connect — test connection or fetch projects/boards before saving a config
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, siteUrl, email, apiToken, projectKey, boardId, sprintState, query } = body;

    if (!siteUrl || !email || !apiToken) {
      return NextResponse.json(
        { error: "siteUrl, email, and apiToken are required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "test": {
        const result = await testJiraConnection(siteUrl, email, apiToken);
        return NextResponse.json(result);
      }

      case "projects": {
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
        const sprints = await getJiraSprints(siteUrl, email, apiToken, boardId, sprintState);
        return NextResponse.json({ sprints });
      }

      default:
        return NextResponse.json({ error: "Unknown action. Use: test, projects, boards, sprints" }, { status: 400 });
    }
  } catch (error) {
    console.error("POST /api/admin/jira/connect error:", error);
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
