import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "#/providers/auth-context";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [{ title: "Eye Academy" }],
	}),
	component: Home,
});

function Home() {
	const { email, signedIn } = useAuth();

	return (
		<main className="page-wrap px-4 pb-8 pt-14">
			<section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
				<p className="island-kicker mb-3">Voice viva</p>
				<h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-foreground sm:text-6xl">
					Eye Academy
				</h1>
				<p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
					A practice viva for ophthalmology trainees. Sign in, ask for
					examination findings, and review one revision point taken from the
					reference note.
				</p>
				{signedIn ? (
					<div className="flex flex-wrap items-center gap-3">
						<Link
							to="/viva"
							className="rounded-full border border-primary bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground no-underline"
						>
							Your vivas
						</Link>
						{email ? (
							<p className="m-0 text-sm font-semibold text-foreground">
								Signed in as {email}
							</p>
						) : null}
					</div>
				) : (
					<div className="flex flex-wrap gap-3">
						<Link
							to="/login"
							className="rounded-full border border-primary bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground no-underline"
						>
							Sign in
						</Link>
						<Link
							to="/register"
							className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground no-underline"
						>
							Create an account
						</Link>
					</div>
				)}
			</section>

			<section className="island-shell mt-8 rounded-2xl p-6 sm:p-8">
				<p className="island-kicker mb-2">Case EA-VIVA-001</p>
				<h2 className="display-title mb-3 text-3xl font-bold text-foreground sm:text-4xl">
					Painful red right eye after a night at the cinema
				</h2>
				<p className="m-0 max-w-3xl text-base leading-8 text-foreground">
					A 64-year-old woman attends eye casualty at 23:40 with a painful red
					right eye. Ask me for any examination findings you need, then tell me
					your diagnosis and immediate management.
				</p>
			</section>

			<section className="mt-8 grid gap-4 sm:grid-cols-2">
				{[
					[
						"Spoken findings",
						"The examiner reads a finding back and shows the eye, value, and units.",
					],
					[
						"Missing findings",
						"If a finding was not recorded, the examiner says so instead of inventing one.",
					],
					[
						"Saved attempts",
						"Your transcript and revealed findings stay private to you after a refresh.",
					],
					[
						"Revision point",
						"After the viva, one point is drawn from the glaucoma and angle closure note, with a page number and a short excerpt.",
					],
				].map(([title, description]) => (
					<article key={title} className="island-shell rounded-2xl p-5">
						<h2 className="mb-2 text-base font-semibold text-foreground">
							{title}
						</h2>
						<p className="m-0 text-sm text-muted-foreground">{description}</p>
					</article>
				))}
			</section>

			<p className="mt-8 text-sm text-muted-foreground">
				Fictional case written for training. Not a real patient, and not
				clinical guidance.
			</p>
		</main>
	);
}
