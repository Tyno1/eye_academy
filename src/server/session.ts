import { createServerFn } from "@tanstack/react-start";
import type { User } from "firebase/auth";
import { z } from "zod";

export const SESSION_COOKIE = "__session";

export type SessionUser = {
	uid: string;
	email: string | null;
};

const cookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
	path: "/",
};

export const getSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<SessionUser | null> => {
		const { getCookie } = await import("@tanstack/react-start/server");
		const { readSessionCookie } = await import("#/server/firebaseAdmin");
		const sessionCookie = getCookie(SESSION_COOKIE);
		if (!sessionCookie) return null;
		return readSessionCookie(sessionCookie);
	},
);

export const createSession = createServerFn({ method: "POST" })
	.validator(z.object({ idToken: z.string().min(1) }))
	.handler(async ({ data }) => {
		const { setCookie } = await import("@tanstack/react-start/server");
		const { mintSessionCookie } = await import("#/server/firebaseAdmin");
		const { cookie, maxAge } = await mintSessionCookie(data.idToken);
		setCookie(SESSION_COOKIE, cookie, { ...cookieOptions, maxAge });
	});

export const clearSession = createServerFn({ method: "POST" }).handler(
	async () => {
		const { deleteCookie } = await import("@tanstack/react-start/server");
		deleteCookie(SESSION_COOKIE, { path: "/" });
	},
);

export async function establishSession(user: User) {
	const idToken = await user.getIdToken();
	await createSession({ data: { idToken } });
}
