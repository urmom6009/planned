// src/app/login/page.tsx
import Link from "next/link";

type Params = { [k: string]: string | string[] | undefined };

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<Params>;
}) {
    const params = await searchParams;
    const error = (params?.error as string) || "";
    const next = (params?.next as string) || "/";

    return (
        <div className="min-h-screen grid place-items-center p-6">
            <div className="w-full max-w-sm rounded-xl border p-5 bg-white/80 dark:bg-zinc-900/60">
                <h1 className="text-xl font-semibold mb-4">Sign in</h1>

                {error && (
                    <p className="mb-3 text-sm text-red-600">
                        {error === "401" ? "Invalid credentials" : error}
                    </p>
                )}

                <form method="POST" action="/api/auth/login" className="grid gap-3">
                    <input
                        name="username"
                        placeholder="Username"
                        className="rounded border px-3 py-2"
                    />
                    <input
                        name="password"
                        type="password"
                        placeholder="Password"
                        className="rounded border px-3 py-2"
                    />
                    {/* preserve where to go after login */}
                    <input type="hidden" name="next" value={next} />
                    <button className="rounded bg-black text-white py-2">Sign in</button>
                </form>

                <div className="mt-4 text-sm text-gray-600">
                    Or try the{" "}
                    <Link href={`/api/magiclink?return=dreamplanner://setup`} className="underline">
                        magic link
                    </Link>
                    .
                </div>
            </div>
        </div>
    );
}