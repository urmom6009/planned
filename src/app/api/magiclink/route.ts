// /src/app/api/magiclink/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

function sign(payload: string, secret: string) {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const returnScheme = url.searchParams.get("return") || "dreamplanner://setup";

    const SECRET = process.env.MAGIC_SIGNING_SECRET;
    if (!SECRET) {
        return NextResponse.json({ error: "Server not configured: missing MAGIC_SIGNING_SECRET" }, { status: 500 });
    }

    // optional environment data (use whatever you have)
    const base = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.LOCAL_BASE_URL || ""; // set LOCAL_BASE_URL=http://192.168.0.191:3000 if you want

    const task = process.env.TASK_LIST_ID || "";
    const mile = process.env.MILESTONE_LIST_ID || "";

    // you can also choose to NOT embed any IDs; app will still open SetupView
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = `${nonce}.${base}.${task}.${mile}`;
    const sig = sign(payload, SECRET);

    // deep link back to app
    const deep = new URL(returnScheme);
    deep.searchParams.set("nonce", nonce);
    if (base) deep.searchParams.set("base", base);
    if (task) deep.searchParams.set("task", task);
    if (mile) deep.searchParams.set("mile", mile);
    deep.searchParams.set("sig", sig);

    // you can either redirect to the deep link (so Safari opens your app)
    // or return JSON for debugging. Redirect is nicer UX:
    return NextResponse.redirect(deep.toString());
}