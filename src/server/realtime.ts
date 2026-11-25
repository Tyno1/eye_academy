import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "gpt-realtime-2.1-mini";

export const mintSession = createServerFn({ method: "POST" })
	.validator(z.object({ attemptId: z.string().min(1) }))
	.handler(async () => {
		const { requireUser } = await import("#/server/firebaseAdmin");
		const { examinerBrief } = await import("#/case/findings");
		const user = await requireUser();
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) throw new Error("Set OPENAI_API_KEY to start the viva voice.");

		const brief = examinerBrief();
		const response = await fetch(
			"https://api.openai.com/v1/realtime/client_secrets",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Safety-Identifier": user.uid.slice(0, 128),
				},
				body: JSON.stringify({
					expires_after: { anchor: "created_at", seconds: 600 },
					session: {
						type: "realtime",
						model: MODEL,
						instructions: instructions(brief.opening),
						audio: {
							input: {
								transcription: { model: "gpt-4o-mini-transcribe" },
								turn_detection: {
									type: "server_vad",
									create_response: false,
									interrupt_response: false,
									silence_duration_ms: 1200,
								},
							},
							output: { voice: "marin" },
						},
						tool_choice: "auto",
						tools: tools(),
					},
				}),
			},
		);
		if (!response.ok) {
			throw new Error("Could not start the voice session.");
		}
		const secret = (await response.json()) as { value?: string };
		if (!secret.value) throw new Error("Could not start the voice session.");
		return { value: secret.value };
	});

function instructions(opening: string) {
	return [
		"# Role",
		"You are the examiner in a fictional ophthalmology practice viva. The trainee leads by asking questions; you only answer them.",
		"Never teach, hint, praise, or say whether the trainee is right.",
		"",
		"# Case",
		`The trainee already has this opening on screen. Do not read it aloud. """${opening}"""`,
		"",
		"# Answering questions about the patient",
		"Every patient fact (history, symptoms, examination findings) comes from getFinding.",
		"Call getFinding once per trainee question and pass their words unchanged, including any eye they named.",
		"If they ask for every finding, or all components of one eye or one examination, still make a single call with their words. Do not split it up or pick one structure.",
		"Say the returned spoken text exactly, with nothing added: no greeting, preface, thanks, summary, or question of your own.",
		"If the spoken text asks which eye, stop and wait. When the trainee names the eye, call getFinding again with their original question plus that eye. Never choose right or left yourself.",
		"Never state an eye, value, unit, or clinical fact that did not come from getFinding.",
		"Never ask the trainee for symptoms, history, or findings.",
		"",
		"# Diagnosis and management",
		"When the trainee first states their own diagnosis or management, call recordAnswer with their exact words and do not speak.",
		"Say the returned spoken text exactly, with nothing added.",
		"That sentence is the one follow-up. Do not end the viva in that turn, and do not thank the trainee.",
		"If they add more diagnosis or management before answering the follow-up, call recordAnswer again and do not ask another question.",
		"",
		"# Ending",
		'After the trainee answers the follow-up, call recordAnswer with that answer and do not speak. Say only the returned spoken text, which is: "The viva is complete."',
		"",
		"# Not a question",
		'Coughs, sneezes, background noise, fillers like "um", and unfinished sentences are not questions or answers. Do not respond to them.',
	].join("\n");
}

function tools() {
	return [
		{
			type: "function",
			name: "getFinding",
			description:
				"Look up one history item, examination finding, or a request for the diagnosis. Say only the spoken field.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"The finding the trainee asked for, including which eye.",
					},
				},
				required: ["query"],
			},
		},
		{
			type: "function",
			name: "recordAnswer",
			description:
				"Store the trainee's diagnosis or management answer. Say only the spoken field, with nothing added.",
			parameters: {
				type: "object",
				properties: {
					text: { type: "string", description: "What the trainee said." },
				},
				required: ["text"],
			},
		},
		{
			type: "function",
			name: "endViva",
			description: "End the attempt after the follow-up has been answered.",
			parameters: { type: "object", properties: {} },
		},
	];
}
