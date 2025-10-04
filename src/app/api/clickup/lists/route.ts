// src/app/api/clickup/lists/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireBearer } from "@/lib/auth"; // relative import

type ClickUpTeam = { id: string; name: string };
type ClickUpSpace = { id: string; name: string };
type ClickUpFolder = { id: string; name: string };
type ClickUpFolderList = { id: string; name: string };
type ClickUpFolderlessList = { id: string; name: string };

type CU_Teams = { teams: ClickUpTeam[] };
type CU_Spaces = { spaces: ClickUpSpace[] };
type CU_Folderless = { lists: ClickUpFolderlessList[] };
type CU_Folders = { folders: (ClickUpFolder & { lists?: ClickUpFolderList[] })[] };
type CU_ListsInFolder = { lists: ClickUpFolderList[] };

export type NormalizedList = {
    id: string;
    name: string;
    spaceId: string;
    spaceName: string;
    folderId?: string;
    folderName?: string;
};

async function fetchJSON<T>(url: string, bearer: string): Promise<T> {
    const res = await fetch(url, {
        headers: { Authorization: bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`ClickUp ${res.status} at ${url}`);
    return (await res.json()) as T;
}

async function pickTeam(bearer: string, hintId?: string, hintName?: string): Promise<ClickUpTeam> {
    const teams = await fetchJSON<CU_Teams>("https://api.clickup.com/api/v2/team", bearer);
    if (hintId) {
        const t = teams.teams.find(x => x.id === hintId);
        if (t) return t;
    }
    if (hintName) {
        const t = teams.teams.find(x => x.name?.toLowerCase() === hintName.toLowerCase());
        if (t) return t;
    }
    if (process.env.CLICKUP_TEAM_ID) {
        const t = teams.teams.find(x => x.id === process.env.CLICKUP_TEAM_ID);
        if (t) return t;
    }
    if (!teams.teams.length) throw new Error("No ClickUp teams on token");
    return teams.teams[0];
}

async function listsForSpace(space: ClickUpSpace, bearer: string): Promise<NormalizedList[]> {
    const out: NormalizedList[] = [];

    const folderless = await fetchJSON<CU_Folderless>(
        `https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`,
        bearer
    );
    out.push(
        ...folderless.lists.map(l => ({
            id: l.id,
            name: l.name,
            spaceId: space.id,
            spaceName: space.name,
        }))
    );

    const folders = await fetchJSON<CU_Folders>(
        `https://api.clickup.com/api/v2/space/${space.id}/folder`,
        bearer
    );
    for (const f of folders.folders) {
        if (!f.id) continue;
        const inFolder = await fetchJSON<CU_ListsInFolder>(
            `https://api.clickup.com/api/v2/folder/${f.id}/list`,
            bearer
        );
        out.push(
            ...inFolder.lists.map(l => ({
                id: l.id,
                name: `${f.name} / ${l.name}`,
                spaceId: space.id,
                spaceName: space.name,
                folderId: f.id,
                folderName: f.name,
            }))
        );
    }

    return out;
}

export async function GET(req: NextRequest) {
    try {
        const bearer = requireBearer(req);

        const url = new URL(req.url);
        const hintId = url.searchParams.get("team") ?? undefined;
        const hintName = url.searchParams.get("teamName") ?? undefined;

        const team = await pickTeam(bearer, hintId, hintName);
        const spaces = await fetchJSON<CU_Spaces>(
            `https://api.clickup.com/api/v2/team/${team.id}/space`,
            bearer
        );

        const lists: NormalizedList[] = [];
        for (const s of spaces.spaces) {
            lists.push(...(await listsForSpace(s, bearer)));
        }
        lists.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ teamId: team.id, teamName: team.name, count: lists.length, lists });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message === "Unauthorized" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}