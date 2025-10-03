// src/app/api/clickup/lists/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CU = "https://api.clickup.com/api/v2";

// Strategy: if you have per-user tokens, read them from your session/JWT.
// For now, fall back to a server-wide token for development.
function resolveClickUpToken(req: Request) {
    // 1) Prefer per-user token from your app session (if you implemented that)
    // const auth = req.headers.get("authorization");
    // if (auth?.startsWith("Bearer ")) { return auth.slice(7); }

    // 2) Dev fallback (single-user):
    const token = process.env.CLICKUP_API_TOKEN;
    return token || "";
}

// Optional: mark which team is work/personal (future balance rules)
const WORK_TEAM_ID = process.env.CLICKUP_WORK_TEAM_ID || "";
const PERSONAL_TEAM_ID = process.env.CLICKUP_PERSONAL_TEAM_ID || "";

async function cuFetch<T>(path: string, token: string): Promise<T> {
    const res = await fetch(`${CU}${path}`, {
        headers: { Authorization: token, "Content-Type": "application/json" },
        cache: "no-store",
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ClickUp ${path} ${res.status}: ${body}`);
    }
    return res.json();
}

export async function GET(req: Request) {
    const token = resolveClickUpToken(req);
    if (!token) {
        return NextResponse.json({ error: "No ClickUp token available" }, { status: 401 });
    }

    try {
        // 1) Teams (workspaces)
        const teamsResp = await cuFetch<{ teams: Array<{ id: string; name: string }> }>(`/team`, token);
        const teams = teamsResp.teams || [];

        // 2) For each team → spaces
        const groups: Array<{ domain: "work" | "personal" | "unknown"; teamId: string; teamName: string; lists: Array<{ id: string; name: string; spaceId: string; spaceName: string }> }> = [];

        for (const team of teams) {
            const spacesResp = await cuFetch<{ spaces: Array<{ id: string; name: string }> }>(
                `/team/${team.id}/space?archived=false`,
                token
            );
            const spaces = spacesResp.spaces || [];

            const lists: Array<{ id: string; name: string; spaceId: string; spaceName: string }> = [];

            for (const space of spaces) {
                // 3a) Folderless lists under space
                const folderless = await cuFetch<{ lists: Array<{ id: string; name: string }> }>(
                    `/space/${space.id}/list?archived=false`,
                    token
                );
                for (const l of folderless.lists || []) {
                    lists.push({ id: l.id, name: l.name, spaceId: space.id, spaceName: space.name });
                }

                // 3b) Folder lists under space
                const foldersResp = await cuFetch<{ folders: Array<{ id: string; name: string }> }>(
                    `/space/${space.id}/folder?archived=false`,
                    token
                );
                for (const f of foldersResp.folders || []) {
                    const inFolder = await cuFetch<{ lists: Array<{ id: string; name: string }> }>(
                        `/folder/${f.id}/list?archived=false`,
                        token
                    );
                    for (const l of inFolder.lists || []) {
                        lists.push({ id: l.id, name: l.name, spaceId: space.id, spaceName: space.name });
                    }
                }
            }

            const domain =
                team.id === WORK_TEAM_ID ? "work" :
                    team.id === PERSONAL_TEAM_ID ? "personal" : "unknown";

            groups.push({
                domain, teamId: team.id, teamName: team.name, lists
            });
        }

        return NextResponse.json({ groups });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "ClickUp Error" }, { status: 500 });
    }
}