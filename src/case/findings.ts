import rawCase from "./case.json";

export type CaseEye = "right" | "left" | "both" | null;

export type CaseFinding = {
	id: string;
	eye: CaseEye;
	name: string;
	aliases: string[];
	available: boolean;
	value: string | null;
	method: string | null;
	unavailableReason: string | null;
};

type OfficialFinding = {
	id: string;
	eye: CaseEye;
	label: string;
	value: string | number | null;
	unit: string | null;
	method: string | null;
	available: boolean;
	unavailable_reason?: string;
};

type OfficialCase = {
	case_id: string;
	title: string;
	opening_prompt: string;
	patient: {
		age: number;
		sex: string;
		presenting_complaint: string;
		past_ocular_history: string;
		past_medical_history: string;
		medications: string[];
		allergies: string;
		family_history: string;
	};
	findings: OfficialFinding[];
	examiner_notes: {
		follow_up_ideas: string[];
	};
};

export type FindingMatch = {
	kind: "finding";
	finding: CaseFinding;
	findings?: CaseFinding[];
	spoken: string;
};

export type FindingLookup =
	| FindingMatch
	| { kind: "clarify" | "missing"; spoken: string };

const caseFile = rawCase as OfficialCase;

const eyeWords: Record<Exclude<CaseEye, null>, string[]> = {
	right: ["right", "od"],
	left: ["left", "os", "fellow"],
	both: ["both", "either eye", "each eye"],
};

const extraAliases: Record<string, string[]> = {
	"history-presenting": [
		"presenting complaint",
		"history of presenting",
		"what happened",
		"symptoms",
		"the history",
	],
	"history-ocular": [
		"past ocular",
		"ocular history",
		"eye history",
		"previous surgery",
		"long-sighted",
		"glasses",
	],
	"history-medical": ["past medical", "medical history", "hypertension"],
	"history-medications": [
		"medication",
		"medications",
		"drugs",
		"amlodipine",
		"chlorphenamine",
		"antihistamine",
	],
	"history-allergies": ["allergy", "allergies", "sulfonamide"],
	"history-family": ["family history"],
	"history-patient": ["how old", "age", "sex"],
	va_right: ["visual acuity", "acuity", "va", "vision", "snellen"],
	va_left: ["visual acuity", "acuity", "va", "vision", "snellen"],
	iop_right: [
		"intraocular pressure",
		"iop",
		"eye pressure",
		"ocular pressure",
		"pressure",
	],
	iop_left: [
		"intraocular pressure",
		"iop",
		"eye pressure",
		"ocular pressure",
		"pressure",
	],
	conj_right: ["conjunctiva", "injection", "ciliary flush"],
	conj_left: ["conjunctiva", "injection"],
	cornea_right: ["cornea", "corneal oedema", "oedema"],
	cornea_left: ["cornea"],
	ac_right: ["anterior chamber", "van herick", "chamber depth", "ac depth"],
	ac_left: ["anterior chamber", "van herick", "chamber depth", "ac depth"],
	pupil_right: ["pupil", "pupils"],
	pupil_left: ["pupil", "pupils"],
	rapd: ["rapd", "relative afferent", "afferent", "swinging light"],
	lens_right: ["lens", "cataract", "nuclear sclerosis"],
	lens_left: ["lens", "cataract", "nuclear sclerosis"],
	gonio_right: ["gonioscopy", "gonio", "angle"],
	gonio_left: ["gonioscopy", "gonio", "angle", "iridotrabecular"],
	fundus_right: ["fundus", "optic disc", "disc", "retina", "macula"],
	fundus_left: ["fundus", "optic disc", "disc", "retina", "macula", "cup"],
	refraction: ["refraction", "prescription", "focimetry", "dioptres"],
	axial_length: ["axial length", "biometry", "axial"],
	oct: ["oct", "optical coherence"],
	bp: ["blood pressure", "systemic pressure"],
	u_and_e: ["urea", "electrolytes", "u and e", "bloods"],
};

const findings = [
	...historyFindings(caseFile.patient),
	...caseFile.findings.map(fromOfficial),
];

export function examinerBrief() {
	return {
		opening: caseFile.opening_prompt,
		followUps: caseFile.examiner_notes.follow_up_ideas,
	};
}

export function followUpFor(answer: string) {
	const text = answer.toLowerCase();
	const [left, pilocarpine, pressure] = caseFile.examiner_notes.follow_up_ideas;
	if (/\bpilocarpine\b/.test(text)) return pilocarpine;
	if (
		/\bpressure\b/.test(text) &&
		/\b(not come|doesn't come|does not come)\b/.test(text)
	) {
		return pressure;
	}
	return left;
}

export function speakFinding(finding: CaseFinding) {
	const eye =
		finding.eye === "right" || finding.eye === "left"
			? `${capitalise(finding.eye)} `
			: "";
	if (!finding.available) {
		return `${eye}${finding.name} is not available. ${finding.unavailableReason}`;
	}
	const method = finding.method ? `, recorded by ${finding.method}` : "";
	const value = finding.value?.replace(/\.$/, "") ?? "";
	return `${eye}${finding.name} is ${value}${method}.`;
}

export function lookupFinding(query: string, said?: string): FindingLookup {
	const text = chooseQuery(query, said);
	if (/\bdiagnos/.test(text)) {
		return {
			kind: "missing",
			spoken:
				"I will not give the diagnosis. Tell me your diagnosis and your immediate management.",
		};
	}
	if (asksForWholeEye(text)) {
		const eye = mentionedEye(text);
		if (eye !== "right" && eye !== "left") {
			return {
				kind: "clarify",
				spoken:
					"Do you want every recorded finding for the right eye or the left?",
			};
		}
		const exam = findings.filter((finding) => finding.eye === eye);
		return {
			kind: "finding",
			finding: exam[0],
			findings: exam,
			spoken: exam.map((finding) => speakFinding(finding)).join(" "),
		};
	}
	const eye = mentionedEye(text);
	const ranked = findings
		.map((finding) => ({ finding, score: scoreFinding(finding, text, eye) }))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score);

	const best = ranked[0];
	if (!best) {
		return {
			kind: "missing",
			spoken: "That finding was not recorded. I can't give you a value for it.",
		};
	}

	if (eye === "both") {
		const sides = ranked
			.filter(
				(item) =>
					item.finding.name === best.finding.name &&
					(item.finding.eye === "right" || item.finding.eye === "left"),
			)
			.sort(
				(left, right) =>
					eyeOrder(left.finding.eye) - eyeOrder(right.finding.eye),
			);
		if (sides.length > 1) {
			return {
				kind: "finding",
				finding: sides[0].finding,
				findings: sides.map((item) => item.finding),
				spoken: sides.map((item) => speakFinding(item.finding)).join(" "),
			};
		}
	}
	if (!eye) {
		const sides = findings.filter(
			(finding) =>
				finding.name === best.finding.name &&
				(finding.eye === "right" || finding.eye === "left"),
		);
		if (sides.length > 1) {
			return {
				kind: "clarify",
				spoken: `Do you want the right ${best.finding.name.toLowerCase()} or the left?`,
			};
		}
	}

	return {
		kind: "finding",
		finding: best.finding,
		spoken: speakFinding(best.finding),
	};
}

function fromOfficial(finding: OfficialFinding): CaseFinding {
	const value =
		finding.value === null
			? null
			: finding.unit &&
					!String(finding.value)
						.toLowerCase()
						.includes(finding.unit.toLowerCase())
				? [finding.value, finding.unit].join(" ")
				: String(finding.value);
	return {
		id: finding.id,
		eye: finding.eye,
		name: finding.label,
		aliases: aliasesFor(finding.id, finding.label),
		available: finding.available,
		value,
		method: finding.method,
		unavailableReason: finding.unavailable_reason ?? null,
	};
}

function historyFindings(patient: OfficialCase["patient"]): CaseFinding[] {
	const rows: Array<[string, string, string]> = [
		["history-patient", "Patient", `a ${patient.age}-year-old ${patient.sex}`],
		[
			"history-presenting",
			"Presenting complaint",
			patient.presenting_complaint,
		],
		["history-ocular", "Past ocular history", patient.past_ocular_history],
		["history-medical", "Past medical history", patient.past_medical_history],
		["history-medications", "Medications", patient.medications.join("; ")],
		["history-allergies", "Allergies", patient.allergies],
		["history-family", "Family history", patient.family_history],
	];
	return rows.map(([id, name, value]) => ({
		id,
		eye: null,
		name,
		aliases: aliasesFor(id, name),
		available: true,
		value,
		method: null,
		unavailableReason: null,
	}));
}

function aliasesFor(id: string, label: string) {
	return [...new Set([label.toLowerCase(), ...(extraAliases[id] ?? [])])];
}

function scoreFinding(finding: CaseFinding, query: string, eye: CaseEye) {
	const matched = finding.aliases.filter((alias) => query.includes(alias));
	if (matched.length === 0) return 0;
	if (query.includes("blood pressure") && finding.id.startsWith("iop"))
		return 0;
	if (
		(query.includes("intraocular") || padded(query).includes(" iop ")) &&
		finding.id === "bp"
	) {
		return 0;
	}
	let score = Math.max(...matched.map((alias) => alias.length));
	if (finding.id === "history-patient" && !asksAboutPatient(query, matched)) {
		return 0;
	}
	if (
		eye &&
		eye !== "both" &&
		finding.eye &&
		finding.eye !== eye &&
		finding.eye !== "both"
	) {
		score -= 20;
	}
	if (eye && eye !== "both" && finding.eye === eye) score += 5;
	return score;
}

function asksAboutPatient(query: string, matched: string[]) {
	if (matched.some((alias) => alias !== "patient")) return true;
	return /\b(how old|age|sex|who is the patient|about the patient)\b/.test(
		query,
	);
}

export function asksForWholeEye(query: string) {
	const text = query.toLowerCase().replace(/[^a-z0-9/+ ]/g, " ");
	const broad = /\b(all|every|everything|entire|whole|components?)\b/.test(
		text,
	);
	const scope =
		/\b(eye|eyes|finding|findings|information|components?|examination)\b/.test(
			text,
		);
	return broad && scope;
}

function chooseQuery(query: string, said?: string) {
	const trainee = normalize(said ?? "");
	const model = normalize(query);
	if (trainee && asksForWholeEye(trainee)) return trainee;
	const eye = trainee ? mentionedEye(trainee) : null;
	if (!eye) return stripEye(model || trainee);
	const side = eye === "both" ? "both eyes" : eye;
	return `${stripEye(model || trainee)} ${side}`.trim();
}

function normalize(query: string) {
	return query
		.toLowerCase()
		.replace(/[^a-z0-9/+ ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function stripEye(text: string) {
	return text
		.replace(/\b(right|left|both|fellow|od|os)\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function padded(query: string) {
	return ` ${query} `;
}

function mentionedEye(query: string): CaseEye {
	const hits = (Object.keys(eyeWords) as Array<Exclude<CaseEye, null>>).filter(
		(eye) => eyeWords[eye].some((word) => padded(query).includes(` ${word} `)),
	);
	if (
		hits.includes("both") ||
		(hits.includes("right") && hits.includes("left"))
	) {
		return "both";
	}
	if (hits.length === 1) return hits[0];
	return null;
}

function eyeOrder(eye: CaseEye) {
	if (eye === "right") return 0;
	if (eye === "left") return 1;
	return 2;
}

function capitalise(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
