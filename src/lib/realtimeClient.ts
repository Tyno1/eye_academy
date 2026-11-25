import { mintSession } from "#/server/realtime";
import {
	endViva,
	getFinding,
	recordAnswer,
	recordUtterance,
} from "#/server/tools";

type Line = { role: "trainee" | "examiner"; text: string; at?: number };

type ConnectArgs = {
	attemptId: string;
	onLine: (line: Line) => void;
	onState: (state: "your-turn" | "you" | "examiner") => void;
};

export async function connectViva({ attemptId, onLine, onState }: ConnectArgs) {
	const audio = document.createElement("audio");
	audio.autoplay = true;
	audio.setAttribute("playsinline", "");
	document.body.appendChild(audio);
	void audio.play().catch(() => undefined);

	let value: string;
	try {
		({ value } = await mintSession({ data: { attemptId } }));
	} catch (error) {
		audio.remove();
		throw error;
	}
	const peer = new RTCPeerConnection();
	let media: MediaStream | null = null;
	let channel: RTCDataChannel | null = null;

	let monitor = 0;
	const disconnect = () => {
		for (const track of media?.getTracks() ?? []) track.stop();
	};
	const close = () => {
		window.clearInterval(monitor);
		void audioContext?.close();
		audio.pause();
		audio.srcObject = null;
		audio.remove();
		channel?.close();
		peer.close();
	};

	let responseOpen = false;
	let responseSettled: (() => void) | null = null;
	let speechRequested = false;
	const outputs: QueuedReply[] = [];
	const toSpeak: string[] = [];
	const traineeAts: number[] = [];
	let findingSpoken = false;
	let traineeSaid = "";
	let traineeSaidReady: (() => void) | null = null;
	let pendingQuestion = "";
	let traineeTurn = 0;
	let followUpTurn = 0;
	let vivaClosed = false;
	const claimFollowUp = () => {
		if (followUpTurn > 0) return false;
		followUpTurn = traineeTurn || 1;
		return true;
	};
	const readyToClose = () => followUpTurn > 0 && traineeTurn > followUpTurn;
	const claimClose = () => {
		if (vivaClosed || !readyToClose()) return false;
		vivaClosed = true;
		return true;
	};
	let sequence = Date.now();
	const stamp = () => {
		sequence += 1;
		return sequence;
	};
	const waitForTrainee = () => {
		if (traineeSaid) return Promise.resolve(traineeSaid);
		return new Promise<string>((resolve) => {
			const timer = window.setTimeout(() => {
				traineeSaidReady = null;
				resolve(traineeSaid);
			}, 1500);
			traineeSaidReady = () => {
				window.clearTimeout(timer);
				resolve(traineeSaid);
			};
		});
	};
	const setMic = (live: boolean) => {
		for (const track of media?.getTracks() ?? []) track.enabled = live;
	};
	let micLive = true;
	let quietSince = 0;
	let audibleUntil = 0;
	let hear: AnalyserNode | null = null;
	let hearData: Uint8Array<ArrayBuffer> | null = null;
	let audioContext: AudioContext | null = null;
	const level = () => {
		if (!hear || !hearData) return 0;
		hear.getByteTimeDomainData(hearData);
		let sum = 0;
		for (const value of hearData) {
			const sample = (value - 128) / 128;
			sum += sample * sample;
		}
		return Math.sqrt(sum / hearData.length);
	};
	const syncMic = () => {
		if (audioContext?.state === "suspended") void audioContext.resume();
		const busy =
			responseOpen ||
			speechRequested ||
			outputs.length > 0 ||
			toSpeak.length > 0;
		if ((busy || !micLive) && level() >= 0.02) {
			audibleUntil = Math.max(audibleUntil, Date.now() + 800);
		}
		const speaking = busy || Date.now() < audibleUntil;
		if (speaking) {
			quietSince = 0;
			if (micLive) {
				micLive = false;
				setMic(false);
			}
			onState("examiner");
			return;
		}
		if (micLive) {
			quietSince = 0;
			return;
		}
		if (quietSince === 0) quietSince = Date.now();
		if (Date.now() - quietSince < 1200) return;
		micLive = true;
		setMic(true);
		onState("your-turn");
	};
	const pump = () => {
		if (
			responseOpen ||
			speechRequested ||
			channel?.readyState !== "open" ||
			!channel
		) {
			return;
		}
		let spokenNext = "";
		if (outputs.length > 0) {
			const batch = outputs.splice(0, outputs.length);
			for (const reply of batch) {
				channel.send(
					JSON.stringify({
						type: "conversation.item.create",
						item: {
							type: "function_call_output",
							call_id: reply.callId,
							output: JSON.stringify(reply.output),
						},
					}),
				);
				if (reply.spoken && !spokenNext) spokenNext = reply.spoken;
			}
		}
		const spoken = spokenNext || toSpeak.shift();
		if (!spoken) return;
		speechRequested = true;
		micLive = false;
		quietSince = 0;
		setMic(false);
		onState("examiner");
		channel.send(
			JSON.stringify({
				type: "response.create",
				response: {
					instructions: `Say exactly these words and nothing else: ${spoken}`,
				},
			}),
		);
		const words = spoken.split(/\s+/).filter(Boolean).length;
		audibleUntil = Math.max(audibleUntil, Date.now() + words * 320 + 900);
	};
	const noteResponse = (open: boolean) => {
		responseOpen = open;
		if (open) {
			speechRequested = false;
			micLive = false;
			quietSince = 0;
			setMic(false);
		}
		if (!open) {
			speechRequested = false;
			responseSettled?.();
			pump();
			syncMic();
		}
		return responseOpen || speechRequested;
	};

	try {
		peer.ontrack = (event) => {
			const remote = event.streams[0] ?? new MediaStream([event.track]);
			audio.srcObject = remote;
			void audio.play().catch(() => undefined);
			if (hear) return;
			const context = new AudioContext();
			audioContext = context;
			void context.resume();
			const source = context.createMediaStreamSource(remote);
			const analyser = context.createAnalyser();
			analyser.fftSize = 512;
			source.connect(analyser);
			hear = analyser;
			hearData = new Uint8Array(analyser.fftSize);
		};

		media = await navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true },
		});
		for (const track of media.getTracks()) peer.addTrack(track);
		monitor = window.setInterval(syncMic, 100);
		onState("your-turn");

		const askExaminer = () => {
			if (
				!micLive ||
				responseOpen ||
				speechRequested ||
				channel?.readyState !== "open" ||
				!channel
			) {
				return;
			}
			speechRequested = true;
			micLive = false;
			quietSince = 0;
			setMic(false);
			onState("examiner");
			channel.send(
				JSON.stringify({
					type: "response.create",
					response: {
						instructions:
							"The trainee just finished speaking. If they stated a diagnosis or a treatment plan, call recordAnswer with their words and do not speak. If they asked for one finding, call getFinding once with their words and do not speak. If they only named an eye, call getFinding with their earlier question plus that eye. Do not add an eye they did not name. A noise is not a question and not a diagnosis. Do not explain, thank them, or end the viva yourself.",
					},
				}),
			);
		};

		const events = peer.createDataChannel("oai-events");
		channel = events;
		events.addEventListener("message", (event) => {
			const payload = JSON.parse(event.data) as { type?: string };
			if (payload.type === "input_audio_buffer.speech_stopped") askExaminer();
			void handleEvent(
				JSON.parse(event.data),
				attemptId,
				onLine,
				onState,
				noteResponse,
				() => responseOpen || speechRequested || !micLive,
				stamp,
				() => {
					findingSpoken = false;
					traineeSaid = "";
					traineeTurn += 1;
					traineeAts.push(stamp());
				},
				() => {
					const at = traineeAts.shift();
					return at ?? stamp();
				},
				(text: string) => {
					traineeSaid = text;
					traineeSaidReady?.();
					traineeSaidReady = null;
				},
				waitForTrainee,
				() => undefined,
				() => undefined,
				() => undefined,
				(reply) => {
					outputs.push(reply);
					pump();
				},
				() => {
					if (findingSpoken) return false;
					findingSpoken = true;
					return true;
				},
				() => pendingQuestion,
				(question: string) => {
					pendingQuestion = question;
				},
				readyToClose,
				claimFollowUp,
				claimClose,
			);
		});

		const offer = await peer.createOffer();
		await peer.setLocalDescription(offer);
		const response = await fetch("https://api.openai.com/v1/realtime/calls", {
			method: "POST",
			body: offer.sdp,
			headers: {
				Authorization: `Bearer ${value}`,
				"Content-Type": "application/sdp",
			},
		});
		if (!response.ok) throw new Error("Could not connect the voice session.");
		await peer.setRemoteDescription({
			type: "answer",
			sdp: await response.text(),
		});
	} catch (error) {
		disconnect();
		close();
		throw error;
	}

	return {
		async disconnect() {
			disconnect();
			const deadline = Date.now() + 8000;
			const pause = Date.now() + 1500;
			while (Date.now() < deadline) {
				if (responseOpen) {
					await new Promise<void>((resolve) => {
						responseSettled = resolve;
						setTimeout(resolve, Math.max(0, deadline - Date.now()));
					});
					if (!responseOpen) break;
				} else if (Date.now() > pause) {
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			close();
		},
	};
}

async function handleEvent(
	event: {
		type?: string;
		name?: string;
		call_id?: string;
		arguments?: string;
		transcript?: string;
	},
	attemptId: string,
	onLine: (line: Line) => void,
	onState: (state: "your-turn" | "you" | "examiner") => void,
	noteResponse: (open: boolean) => boolean,
	examinerTalking: () => boolean,
	stamp: () => number,
	noteSpeechStarted: () => void,
	takeTraineeAt: () => number,
	noteTrainee: (text: string) => void,
	waitForTrainee: () => Promise<string>,
	bufferExaminer: (text: string) => void,
	markFinding: () => void,
	commitExaminer: () => void,
	queueReply: (reply: QueuedReply) => void,
	claimFinding: () => boolean,
	pendingQuestion: () => string,
	setPendingQuestion: (question: string) => void,
	readyToClose: () => boolean,
	claimFollowUp: () => boolean,
	claimClose: () => boolean,
) {
	if (
		event.type === "input_audio_buffer.speech_started" &&
		!examinerTalking()
	) {
		noteSpeechStarted();
		onState("you");
	}
	if (event.type === "response.created") {
		noteResponse(true);
		onState("examiner");
	}
	if (event.type === "response.done") {
		commitExaminer();
		noteResponse(false);
	}
	if (
		event.type === "conversation.item.input_audio_transcription.completed" &&
		event.transcript &&
		/[a-z]/i.test(event.transcript)
	) {
		const at = takeTraineeAt();
		noteTrainee(event.transcript);
		onLine({ role: "trainee", text: event.transcript, at });
		void recordUtterance({
			data: { attemptId, role: "trainee", text: event.transcript, at },
		});
	}
	if (
		event.type === "response.output_audio_transcript.done" &&
		event.transcript
	) {
		bufferExaminer(event.transcript);
	}
	if (event.type !== "response.function_call_arguments.done") return;
	if (!event.name || !event.call_id) return;
	if (event.name === "getFinding" && !claimFinding()) {
		queueReply({
			callId: event.call_id,
			output: {
				spoken: "Do not look up another finding. Wait for the trainee to ask.",
			},
		});
		return;
	}

	let output: unknown;
	try {
		output = await runTool(
			event.name,
			event.arguments,
			attemptId,
			onLine,
			markFinding,
			stamp,
			waitForTrainee,
			pendingQuestion,
			setPendingQuestion,
			readyToClose,
			claimFollowUp,
			claimClose,
		);
	} catch (caught) {
		const message =
			caught instanceof Error ? caught.message : "Could not answer that.";
		onLine({ role: "examiner", text: message, at: stamp() });
		output = { spoken: message };
	}
	const spoken =
		output &&
		typeof output === "object" &&
		"spoken" in output &&
		typeof output.spoken === "string"
			? output.spoken
			: undefined;
	queueReply({
		callId: event.call_id,
		output,
		spoken,
	});
}

type QueuedReply = {
	callId: string;
	output: unknown;
	spoken?: string;
};

async function runTool(
	name: string,
	rawArguments: string | undefined,
	attemptId: string,
	onLine: (line: Line) => void,
	markFinding: () => void,
	stamp: () => number,
	waitForTrainee: () => Promise<string>,
	pendingQuestion: () => string,
	setPendingQuestion: (question: string) => void,
	readyToClose: () => boolean,
	claimFollowUp: () => boolean,
	claimClose: () => boolean,
) {
	const showExaminer = (text: string, at: number) => {
		onLine({ role: "examiner", text, at });
		markFinding();
		void recordUtterance({
			data: { attemptId, role: "examiner", text, at },
		});
		return { spoken: text };
	};
	const args = rawArguments
		? (JSON.parse(rawArguments) as { query?: string; text?: string })
		: {};
	if (name === "getFinding") {
		const at = stamp();
		const said = await waitForTrainee();
		const line = await planLine(said, attemptId, readyToClose());
		if (line) {
			if (readyToClose() ? claimClose() : claimFollowUp()) {
				return showExaminer(line, at);
			}
			return { recorded: true };
		}
		const eyeReply = namesOnlyEye(said);
		const earlier = pendingQuestion();
		const query =
			eyeReply && earlier ? `${earlier} ${said}` : (args.query ?? "");
		const result = await getFinding({
			data: { attemptId, query, said, at },
		});
		if (asksWhichEye(result.spoken) && !eyeReply) {
			setPendingQuestion(said || args.query || "");
		} else {
			setPendingQuestion("");
		}
		if (result.spoken) {
			markFinding();
			onLine({ role: "examiner", text: result.spoken, at });
		}
		return result;
	}
	if (name === "recordAnswer") {
		const said = await waitForTrainee();
		const text = statesDiagnosis(said) ? said : (args.text ?? "");
		const line = await planLine(text, attemptId, readyToClose());
		if (!line) return { recorded: true };
		if (!(readyToClose() ? claimClose() : claimFollowUp())) {
			return { recorded: true };
		}
		return showExaminer(line, stamp());
	}
	if (name === "endViva") {
		if (!claimClose()) return { recorded: true };
		await endViva({ data: { attemptId } });
		return showExaminer("The viva is complete.", stamp());
	}
	return { spoken: "That action is not available." };
}

function namesOnlyEye(text: string) {
	const value = text
		.toLowerCase()
		.replace(/[^a-z ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return /^(the )?(right|left|both)( eye| eyes| one| side)?$/.test(value);
}

function asksWhichEye(spoken: string) {
	const value = spoken.toLowerCase();
	return value.includes("do you want") && value.includes(" or the ");
}

function planLine(said: string, attemptId: string, answering: boolean) {
	if (!said) return Promise.resolve(null);
	if (!statesDiagnosis(said) && !(answering && !asksForFinding(said))) {
		return Promise.resolve(null);
	}
	return recordAnswer({
		data: { attemptId, text: said, stage: answering ? "answer" : "plan" },
	}).then((saved) => saved.spoken);
}

function asksForFinding(text: string) {
	const value = spokenWords(text);
	if (!value) return false;
	if (text.includes("?")) return true;
	return /^(what|how|why|when|where|which|is|are|does|do|did|tell|give|show|can|could|please)\b/.test(
		value,
	);
}

function statesDiagnosis(text: string) {
	const value = spokenWords(text);
	if (!value || asksForFinding(text)) return false;
	return /\b(i think|i would|i will|this is|my diagnosis|diagnosis|management|i arrived|treat|treatment|iridotomy|angle closure|acetazolamide|pilocarpine)\b/.test(
		value,
	);
}

function spokenWords(text: string) {
	return text
		.toLowerCase()
		.replace(/[^a-z ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
