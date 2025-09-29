import { NextRequest, NextResponse } from "next/server";

const states = new Map<string, number>(); // simple demo store

export async function GET(req: NextRequest) {
    const state = crypto.randomUUID();
    states.set(state, Date.now() + 5 * 60_000); // valid 5 min

    const clickupAuth = new URL("https://app.clickup.com/api");
    clickupAuth.pathname = "/v2/oauth/authorize";
    clickupAuth.searchParams.set("client_id", process.env.CLICKUP_CLIENT_ID!);
    clickupAuth.searchParams.set("redirect_uri", process.env.CLICKUP_REDIRECT_URI!);
    clickupAuth.searchParams.set("state", state);
    clickupAuth.searchParams.set("scope", "tasks:read tasks:write");

    return NextResponse.redirect(clickupAuth.toString(), 302);
}

// helper for callback to check state
export function consumeState(s: string) {
    const exp = states.get(s);
    if (!exp || Date.now() > exp) return false;
    states.delete(s);
    return true;
}