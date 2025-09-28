"use client";

import { useSearchParams } from "next/navigation";
import React from "react";

export default function Login() {
    const params = useSearchParams()
    const error = params.get("error");
    const next = params.get("next") || "/";

    return (
        <div className="min-h-screen grid place-items-center p-6">
            <form 
            method="POST"
            action="/api/auth/login"
            className="w-full max-w-sm card-soft p-6 space-y-4"
            >
                <h1 className="text-xl font-bold">DreamPlanner Login</h1>

                {error && (
                    <div className="text-sm rounded-md border border-r-300/50 bg-red-50/60 p-2 text-red-700">
                        Invalid Credentials. Try again.
                    </div>
                )}

                <input type="hidden" name="next" value={next} />

                <label className="block text-sm">
                    <span className="text-slate-600">Username</span>
                    <input
                    name="username"
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    autoComplete="username"
                    />
                </label>

                <label className="block text-sm">
                    <span className="text-slate-600">Password</span>
                    <input
                    name="password"
                    type="password"
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    autoComplete="current-password"
                    />
                </label>

                <button className="w-full bg-pink-500 text-white rounded-md py-2 hover:brightness-110">
                    Sign in
                </button>

                <p className="text-xs text-slate-500">
                    Protected area. You'll stay signed in for 7 days on this device.
                </p>
            </form>
        </div>
    );
}