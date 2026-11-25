import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import noteChunks from "../../data/note_chunks.json";

type NoteChunk = { page: number; text: string };

const STOP = new Set(
	"that this with would will have from they their them then than there were been being what when which while because could should about into also very just like some give them after before eyes".split(
		" ",
	),
);

export function squash(text: string) {
	return text
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201c\u201d]/g, '"')
		.replace(/[\u2013\u2014]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

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
		const selected = selectChunks(answer, noteChunks as NoteChunk[]);
		if (selected.length === 0) {
			return {
				point:
					"The reference note does not support a revision point for that answer.",
				page: null,
				excerpt: null,
				retrievedPages: [],
			};
		}

		const retrievedPages = selected.map((chunk) => chunk.page);
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey)
			throw new Error("Set OPENAI_API_KEY to write the revision point.");
		const drafted = await draftPoint(apiKey, answer, selected);
		const page = selected.find((chunk) => chunk.page === drafted.page);
		if (
			!page ||
			drafted.excerpt.trim().length < 20 ||
			!squash(page.text).includes(squash(drafted.excerpt))
		) {
			return {
				point:
					"The reference note does not support a revision point for that answer.",
				page: null,
				excerpt: null,
				retrievedPages,
			};
		}
		const revision = {
			point: drafted.point,
			page: drafted.page,
			excerpt: drafted.excerpt,
		};
		await ref.set({ revision, retrievedPages }, { merge: true });
		return { ...revision, retrievedPages };
	});

export function selectChunks(answer: string, chunks: NoteChunk[]) {
	const words = new Set(
		(answer.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(
			(word) => !STOP.has(word),
		),
	);
	const bags = chunks.map(
		(chunk) => new Set(chunk.text.toLowerCase().split(/[^a-z]+/)),
	);
	const idf = (word: string) => {
		const df = bags.filter((bag) => bag.has(word)).length;
		return df === 0 ? 0 : Math.log(1 + chunks.length / df);
	};
	return chunks
		.map((chunk, index) => ({
			chunk,
			score: [...words]
				.filter((word) => bags[index].has(word))
				.reduce((sum, word) => sum + idf(word), 0),
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
