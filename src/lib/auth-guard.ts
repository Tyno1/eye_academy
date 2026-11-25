import { redirect } from "@tanstack/react-router";
import { type AuthSearch, safePath } from "#/lib/auth-search";
import type { SessionUser } from "#/server/session";

export function redirectIfSignedIn(
	session: SessionUser | null,
	search: AuthSearch,
) {
	if (!session) return;

	throw redirect({
		href: safePath(search.redirect),
		replace: true,
	});
}

export function redirectIfSignedOut(session: SessionUser | null, href: string) {
	if (session) return;

	throw redirect({
		to: "/login",
		search: { redirect: href.startsWith("/") ? href : "/" },
		replace: true,
	});
}
