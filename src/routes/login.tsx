import { createFileRoute } from "@tanstack/react-router";
import LoginForm from "#/components/LoginForm";
import { redirectIfSignedIn } from "#/lib/auth-guard";
import { authSearch } from "#/lib/auth-search";

export const Route = createFileRoute("/login")({
	validateSearch: authSearch,
	beforeLoad: ({ context, search }) => {
		redirectIfSignedIn(context.session, search);
	},
	head: () => ({
		meta: [{ title: "Login" }],
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect } = Route.useSearch();

	return (
		<main className="page-wrap flex justify-center px-4 py-16">
			<LoginForm redirectTo={redirect} />
		</main>
	);
}
