import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirectIfSignedOut } from "#/lib/auth-guard";

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context, location }) => {
		redirectIfSignedOut(context.session, location.href);
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	return <Outlet />;
}
