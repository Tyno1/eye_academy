import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type NoteChunk = { page: number; text: string };

export const revisionPoint = createServerFn({ method: "POST" })
	.validator(z.object({ attemptId: z.uuid() }))
	.handler(async ({ data }) => {
		const { requireUser, adminFirestore } = await import(
			"#/server/firebaseAdmin"
		);
		const user = await requireUser();
		const ref = adminFirestore().doc(
			`users/${user.uid}/attempts/${data.attemptId}`,
		);
		const snap = await ref.get();
		const answers = Array.isArray(snap.data()?.answers)
			? snap.data()?.answers.filter((item: unknown) => typeof item === "string")
			: [];
		const answer = answers.join(" ");
		const chunks = await loadChunks();
		const selected = selectChunks(answer, chunks);
		if (selected.length === 0) {
			return {
				point:
					"The reference note does not support a revision point for that answer.",
				page: null,
				excerpt: null,
			};
		}

		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey)
			throw new Error("Set OPENAI_API_KEY to write the revision point.");
		const drafted = await draftPoint(apiKey, answer, selected);
		const page = selected.find((chunk) => chunk.page === drafted.page);
		if (!page || !page.text.includes(drafted.excerpt)) {
			return {
				point:
					"The reference note does not support a revision point for that answer.",
				page: null,
				excerpt: null,
			};
		}
		const revision = {
			point: drafted.point,
			page: drafted.page,
			excerpt: drafted.excerpt,
		};
		await ref.set({ revision }, { merge: true });
		return revision;
	});

async function loadChunks() {
	const { readFileSync } = await import("node:fs");
	const raw = readFileSync(
		new URL("../../data/note_chunks.json", import.meta.url),
		"utf8",
	);
	return JSON.parse(raw) as NoteChunk[];
}

function selectChunks(answer: string, chunks: NoteChunk[]) {
	const words = new Set(answer.toLowerCase().match(/[a-z]{4,}/g) ?? []);
	return chunks
		.map((chunk) => ({
			chunk,
			score: chunk.text
				.toLowerCase()
				.split(/[^a-z]+/)
				.filter((word) => words.has(word)).length,
		}))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((item) => item.chunk);
}

async function draftPoint(apiKey: string, answer: string, chunks: NoteChunk[]) {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						"Write one revision point for an ophthalmology trainee. Use only the supplied pages. The excerpt must be copied exactly from one page. Reply as JSON with point, page, and excerpt. If the pages do not support the answer, set point to an empty string.",
				},
				{
					role: "user",
					content: JSON.stringify({
						answer,
						pages: chunks.map((chunk) => ({
							page: chunk.page,
							text: chunk.text,
						})),
					}),
				},
			],
		}),
	});
	if (!response.ok) throw new Error("Could not write the revision point.");
	const payload = (await response.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const content = payload.choices?.[0]?.message?.content;
	if (!content) throw new Error("Could not write the revision point.");
	const parsed = JSON.parse(content) as {
		point?: unknown;
		page?: unknown;
		excerpt?: unknown;
	};
	if (
		typeof parsed.point !== "string" ||
		typeof parsed.page !== "number" ||
		typeof parsed.excerpt !== "string" ||
		parsed.point.length === 0
	) {
		return { point: "", page: 0, excerpt: "" };
	}
	return { point: parsed.point, page: parsed.page, excerpt: parsed.excerpt };
}
