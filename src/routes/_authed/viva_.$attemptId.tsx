import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { connectViva } from "#/lib/realtimeClient";
import { revisionPoint } from "#/server/revision";
import { type AttemptView, loadAttempt } from "#/server/tools";

export const Route = createFileRoute("/_authed/viva_/$attemptId")({
	head: () => ({
		meta: [{ title: "Viva · Eye Academy" }],
	}),
	loader: async ({ params }) =>
		loadAttempt({ data: { attemptId: params.attemptId } }),
	component: VivaAttemptPage,
});

function VivaAttemptPage() {
	const { attemptId } = Route.useParams();
	const initial = Route.useLoaderData();
	const [attempt, setAttempt] = useState<AttemptView>(initial);
	const [state, setState] = useState<
		"ready" | "your-turn" | "you" | "examiner"
	>("ready");
	const [error, setError] = useState("");
	const [connected, setConnected] = useState(false);
	const [stopping, setStopping] = useState(false);
	const session = useRef<{ disconnect: () => Promise<void> } | null>(null);
	const chat = useRef<HTMLElement>(null);
	const youSpeaking = connected && state === "you";
	const examinerSpeaking = connected && state === "examiner";

	useEffect(() => {
		return () => {
			void session.current?.disconnect();
		};
	}, []);

	useEffect(() => {
		const node = chat.current;
		if (!node || attempt.transcript.length === 0) return;
		node.scrollTop = node.scrollHeight;
	}, [attempt.transcript]);

	const addLine = (line: {
		role: "trainee" | "examiner";
		text: string;
		at?: number;
	}) => {
		setAttempt((current) => {
			const text = line.text.trim();
			if (
				current.transcript.some(
					(item) =>
						item.role === line.role &&
						item.text === text &&
						item.at === line.at,
				)
			) {
				return current;
			}
			const transcript = [
				...current.transcript,
				{
					role: line.role,
					text,
					at: line.at ?? Date.now(),
					id: "",
				},
			].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
			return {
				...current,
				transcript: transcript.map((item, index) => ({
					...item,
					id: `${index}-${item.role}`,
				})),
			};
		});
	};

	const addLineRef = useRef(addLine);
	addLineRef.current = addLine;

	useEffect(() => {
		let stop = false;
		const pull = async () => {
			try {
				const saved = await loadAttempt({ data: { attemptId } });
				if (stop) return;
				setAttempt((live) => mergeAttempt(live, saved));
			} catch {
				// The next pull retries. A failed read leaves the lines already on screen.
			}
		};
		void pull();
		const timer = setInterval(() => {
			void pull();
		}, 1000);
		return () => {
			stop = true;
			clearInterval(timer);
		};
	}, [attemptId]);

	const onStart = async () => {
		setError("");
		try {
			const next = await connectViva({
				attemptId,
				onState: setState,
				onLine: (line) => addLineRef.current(line),
			});
			session.current = next;
			setConnected(true);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not start the viva.",
			);
		}
	};

	const onStop = async () => {
		const current = session.current;
		session.current = null;
		setStopping(true);
		await current?.disconnect();
		try {
			const saved = await loadAttempt({ data: { attemptId } });
			setAttempt((live) => mergeAttempt(live, saved));
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not save the answer.",
			);
		}
		setStopping(false);
		setConnected(false);
		setState("ready");
	};

	const onRevision = async () => {
		setError("");
		try {
			const revision = await revisionPoint({ data: { attemptId } });
			setAttempt((current) => ({
				...current,
				revision:
					revision.page && revision.excerpt
						? {
								point: revision.point,
								page: revision.page,
								excerpt: revision.excerpt,
							}
						: null,
			}));
			if (!revision.page) setError(revision.point);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not write the revision point.",
			);
		}
	};

	const recordLabel = stopping
		? "Finishing the answer"
		: connected
			? "Stop recording"
			: "Start recording";

	return (
		<>
			<main className="page-wrap flex h-[calc(100dvh-4.5rem)] flex-col px-4 pt-4 pb-[15rem]">
				<section
					ref={chat}
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
				>
					<div>
						<Link
							to="/viva"
							className="mb-3 inline-block text-sm font-semibold text-muted-foreground no-underline"
						>
							All attempts
						</Link>
						<p className="island-kicker mb-2">Case EA-VIVA-001</p>
						<h1 className="display-title mb-2 text-2xl font-bold text-foreground sm:text-3xl">
							Painful red right eye after a night at the cinema
						</h1>
						<p className="m-0 max-w-3xl text-sm leading-7 text-foreground">
							A 64-year-old woman attends eye casualty at 23:40 with a painful
							red right eye. Ask me for any examination findings you need, then
							tell me your diagnosis and immediate management.
						</p>
					</div>
					{attempt.transcript.length === 0 ? (
						<p className="m-0 text-sm text-muted-foreground">
							The conversation appears here. Start recording, then ask for a
							finding.
						</p>
					) : (
						<div className="grid gap-3">
							{attempt.transcript.map((line) => {
								const examiner = line.role === "examiner";
								return (
									<article
										key={line.id}
										className={
											examiner
												? "mr-10 max-w-3xl justify-self-start"
												: "ml-10 max-w-3xl justify-self-end"
										}
									>
										<p
											className={
												examiner
													? "mb-1 text-xs font-semibold text-muted-foreground"
													: "mb-1 text-right text-xs font-semibold text-primary"
											}
										>
											{examiner ? "Examiner" : "You"}
										</p>
										<p
											className={
												examiner
													? "m-0 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm leading-6 text-foreground"
													: "m-0 rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground"
											}
										>
											{line.text}
										</p>
									</article>
								);
							})}
						</div>
					)}
					{attempt.revision ? (
						<section className="island-shell rounded-2xl p-5">
							<p className="m-0 text-sm text-foreground">
								{attempt.revision.point}
							</p>
							<p className="mt-3 mb-0 text-sm text-muted-foreground">
								Page {attempt.revision.page}. {attempt.revision.excerpt}
							</p>
						</section>
					) : null}
				</section>
			</main>
			<section className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 backdrop-blur-lg">
				<div className="page-wrap flex flex-col items-center gap-1 px-4 py-3">
					{error ? (
						<p className="m-0 max-w-xl text-center text-sm text-foreground">
							{error}
						</p>
					) : null}
					<div className="grid place-items-center px-8 py-5">
						<button
							type="button"
							className={cn(
								"viva-record grid size-24 place-items-center rounded-full shadow-[0_12px_30px_rgba(29,78,216,0.28)] disabled:opacity-50",
								examinerSpeaking
									? "is-speaking bg-foreground text-background"
									: "bg-primary text-primary-foreground",
								youSpeaking && "is-you",
							)}
							onClick={connected ? onStop : onStart}
							disabled={stopping}
							aria-label={recordLabel}
						>
							{connected ? (
								<Square className="size-7 fill-current" aria-hidden />
							) : (
								<Play className="ml-1 size-8 fill-current" aria-hidden />
							)}
						</button>
					</div>
					<p
						className={cn(
							"m-0 text-sm font-semibold",
							examinerSpeaking ? "text-muted-foreground" : "text-primary",
						)}
					>
						{turnLabel(state, stopping, recordLabel)}
					</p>
					{attempt.status === "ended" ? (
						<Button onClick={onRevision}>Revision point</Button>
					) : null}
				</div>
			</section>
		</>
	);
}

function turnLabel(
	state: "ready" | "your-turn" | "you" | "examiner",
	stopping: boolean,
	idle: string,
) {
	if (state === "ready") return idle;
	if (stopping) return "Finishing the answer";
	if (state === "you") return "You are speaking";
	if (state === "examiner") return "Examiner is speaking. Microphone off";
	return "Your turn";
}

function sameRevision(
	live: AttemptView["revision"],
	saved: AttemptView["revision"],
) {
	if (!live || !saved) return !live && !saved;
	return (
		live.point === saved.point &&
		live.page === saved.page &&
		live.excerpt === saved.excerpt
	);
}

function mergeAttempt(live: AttemptView, saved: AttemptView): AttemptView {
	const merged = [...live.transcript];
	for (const line of saved.transcript) {
		if (
			merged.some(
				(item) =>
					item.role === line.role &&
					item.text === line.text &&
					item.at === line.at,
			)
		) {
			continue;
		}
		merged.push(line);
	}
	merged.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
	const unchanged =
		merged.length === live.transcript.length &&
		merged.every(
			(line, index) =>
				line.role === live.transcript[index]?.role &&
				line.text === live.transcript[index]?.text &&
				line.at === live.transcript[index]?.at,
		) &&
		live.status === saved.status &&
		sameRevision(live.revision, saved.revision);
	if (unchanged) return live;
	return {
		...saved,
		transcript: merged.map((line, index) => ({
			...line,
			id: `${index}-${line.role}`,
		})),
	};
}
