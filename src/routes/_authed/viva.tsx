import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { listAttempts } from "#/server/tools";

export const Route = createFileRoute("/_authed/viva")({
	head: () => ({
		meta: [{ title: "Viva · Eye Academy" }],
	}),
	loader: () => listAttempts(),
	component: VivaListPage,
});

function VivaListPage() {
	const attempts = Route.useLoaderData();
	const navigate = useNavigate();

	return (
		<main className="page-wrap px-4 pb-8 pt-14">
			<section className="island-shell rounded-2xl p-6 sm:p-8">
				<p className="island-kicker mb-2">Voice viva</p>
				<h1 className="display-title mb-3 text-3xl font-bold text-foreground sm:text-4xl">
					Your attempts
				</h1>
				<p className="mb-6 max-w-3xl text-base leading-8 text-foreground">
					Open an attempt to continue it and read the conversation.
				</p>
				<Button
					onClick={() => {
						void navigate({
							to: "/viva/$attemptId",
							params: { attemptId: crypto.randomUUID() },
						});
					}}
				>
					New viva
				</Button>
			</section>
			<section className="mt-8 grid gap-4">
				{attempts.length === 0 ? (
					<p className="m-0 text-sm text-muted-foreground">No attempts yet.</p>
				) : (
					attempts.map((attempt) => (
						<Link
							key={attempt.id}
							to="/viva/$attemptId"
							params={{ attemptId: attempt.id }}
							className="island-shell block rounded-2xl p-5 no-underline"
						>
							<p className="m-0 text-sm font-semibold text-foreground">
								{attempt.status === "ended" ? "Ended" : "Active"}
							</p>
							<p className="mt-1 mb-0 text-sm text-muted-foreground">
								{formatWhen(attempt.createdAt)}
								{" · "}
								{attempt.turns === 0
									? "No conversation yet"
									: `${attempt.turns} ${attempt.turns === 1 ? "turn" : "turns"}`}
							</p>
						</Link>
					))
				)}
			</section>
		</main>
	);
}

function formatWhen(value: string | null) {
	if (!value) return "Unknown time";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown time";
	return date.toLocaleString();
}
