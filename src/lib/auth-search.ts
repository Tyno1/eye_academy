export type AuthSearch = {
	redirect?: string;
};

export function authSearch(search: Record<string, unknown>): AuthSearch {
	return {
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	};
}

export function safePath(target: string | undefined) {
	if (!target || !target.startsWith("/")) return "/";
	if (
		target.startsWith("//") ||
		target.startsWith("/\\") ||
		target.includes("://")
	) {
		return "/";
	}

	const path = target.split(/[?#]/, 1)[0];
	if (path === "/login" || path === "/register") return "/";
	return target;
}
