// src/app/api/clickup/lists/route.ts
import { NextRequest, NextResponse } from "next/server";

/** --- ClickUp API types (subset) --- */
type ClickUpTeam = { id: string; name: string };
type ClickUpSpace = { id: string; name: string };
type ClickUpFolder = { id: string; name: string };
type ClickUpFolderList = { id: string; name: string };
type ClickUpFolderlessList = { id: string; name: string };

type CU_TeamsResponse = { teams: ClickUpTeam[] };
type CU_SpacesResponse = { spaces: ClickUpSpace[] };
type CU_FolderlessResponse = { lists: ClickUpFolderlessList[] };
type CU_FoldersResponse = { folders: (ClickUpFolder & { lists?: ClickUpFolderList[] })[] };
type CU_ListsInFolderResponse = { lists: ClickUpFolderList[] };

/** --- Normalized list shape your app expects --- */
export type NormalizedList = {
    id: string;
    name: string;          // "Folder / List" for foldered lists; just "List" for folderless
    spaceId: string;
    spaceName: string;
    folderId?: string;
    folderName?: string;
};

/** Small helper: typed fetch with bearer */
async function fetchJSON<T>(url: string, bearer: string): Promise<T> {
    const res = await fetch(url, {
        headers: { Authorization: bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}` },
        // Avoid caching in build / preview
        next: { revalidate: 0 },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`ClickUp ${res.status} ${res.statusText} at ${url}: ${text}`);
    }
    return (await res.json()) as T;
}

/** Resolve the token: prefer Authorization: Bearer <token>, fallback to env */
function resolveClickUpToken(req: NextRequest): string | null {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.toLowerCase().startsWith("bearer ")) return authHeader.slice(7).trim();
    return process.env.CLICKUP_API_TOKEN ?? null;
}

/** Find the team to enumerate (by id or name; else env; else first available) */
async function resolveTeam(bearer: string, hintId?: string, hintName?: string): Promise<ClickUpTeam> {
    // GET /api/v2/team (docs say `/team` returns teams for the token)
    const teams = await fetchJSON<CU_TeamsResponse>("https://api.clickup.com/api/v2/team", bearer);

    if (hintId) {
        const byId = teams.teams.find(t => t.id === hintId);
        if (byId) return byId;
    }
    if (hintName) {
        const byName = teams.teams.find(t => t.name?.toLowerCase() === hintName.toLowerCase());
        if (byName) return byName;
    }
    if (process.env.CLICKUP_TEAM_ID) {
        const byEnv = teams.teams.find(t => t.id === process.env.CLICKUP_TEAM_ID);
        if (byEnv) return byEnv;
    }
    if (!teams.teams.length) throw new Error("ClickUp: no teams available for token");
    return teams.teams[0]; // sensible default for personal token
}

async function listsForSpace(space: ClickUpSpace, bearer: string): Promise<NormalizedList[]> {
    const spaceId = space.id;

    // Folderless lists
    const folderless = await fetchJSON<CU_FolderlessResponse>(
        `https://api.clickup.com/api/v2/space/${spaceId}/list?archived=false`,
        bearer
    );

    const fromFolderless: NormalizedList[] = folderless.lists.map(l => ({
        id: l.id,
        name: l.name,
        spaceId,
        spaceName: space.name,
    }));

    // Folders
    const folders = await fetchJSON<CU_FoldersResponse>(
        `https://api.clickup.com/api/v2/space/${spaceId}/folder`,
        bearer
    );

    const fromFolders: NormalizedList[] = [];
    for (const f of folders.folders) {
        if (!f.id) continue;
        const inFolder = await fetchJSON<CU_ListsInFolderResponse>(
            `https://api.clickup.com/api/v2/folder/${f.id}/list`,
            bearer
        );
        for (const l of inFolder.lists) {
            fromFolders.push({
                id: l.id,
                name: `${f.name} / ${l.name}`,
                spaceId,
                spaceName: space.name,
                folderId: f.id,
                folderName: f.name,
            });
        }
    }

    return [...fromFolderless, ...fromFolders];
}

/** GET /api/clickup/lists?team=<id>&teamName=<name> */
export async function GET(req: NextRequest) {
    try {
        const bearer = resolveClickUpToken(req);
        if (!bearer) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const teamHintId = searchParams.get("team") ?? undefined;
        const teamHintName = searchParams.get("teamName") ?? undefined;

        const team = await resolveTeam(bearer, teamHintId, teamHintName);

        // Spaces in team
        const spacesResp = await fetchJSON<CU_SpacesResponse>(
            `https://api.clickup.com/api/v2/team/${team.id}/space`,
            bearer
        );

        const lists: NormalizedList[] = [];
        for (const space of spacesResp.spaces) {
            const perSpace = await listsForSpace(space, bearer);
            lists.push(...perSpace);
        }

        // Sort for nice UX
        lists.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json(
            {
                teamId: team.id,
                teamName: team.name,
                count: lists.length,
                lists,
            },
            { status: 200 }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}