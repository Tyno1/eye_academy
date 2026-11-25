import { createFileRoute } from "@tanstack/react-router";
import RegisterForm from "#/components/RegisterForm";
import { redirectIfSignedIn } from "#/lib/auth-guard";
import { authSearch } from "#/lib/auth-search";

export const Route = createFileRoute("/register")({
	validateSearch: authSearch,
	beforeLoad: ({ context, search }) => {
		redirectIfSignedIn(context.session, search);
	},
	head: () => ({
		meta: [{ title: "Register" }],
	}),
	component: RegisterPage,
});

function RegisterPage() {
	const { redirect } = Route.useSearch();

	return (
		<main className="page-wrap flex justify-center px-4 py-16">
			<RegisterForm redirectTo={redirect} />
		</main>
	);
}
