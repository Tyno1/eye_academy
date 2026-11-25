import { describe, expect, it } from "vitest";
import {
	asksForWholeEye,
	examinerBrief,
	followUpFor,
	lookupFinding,
	speakFinding,
	type CaseFinding,
} from "#/case/findings";

describe("examinerBrief", () => {
	it("returns the opening and follow-ups from the case file", () => {
		const brief = examinerBrief();
		expect(brief.opening).toContain("painful red right eye");
		expect(brief.followUps).toHaveLength(3);
		expect(brief.followUps[0]).toBe("Why treat the left eye as well?");
	});
});

describe("followUpFor", () => {
	it("asks about pilocarpine when the answer mentions it", () => {
		expect(followUpFor("I would give pilocarpine")).toBe(
			"Why might pilocarpine not work at first when the pressure is very high?",
		);
	});

	it("asks about refractory pressure when that plan is mentioned", () => {
		expect(
			followUpFor("If the pressure does not come down I would refer"),
		).toBe("What would you do if the pressure doesn't come down?");
	});

	it("defaults to the fellow-eye follow-up", () => {
		expect(followUpFor("Acute angle closure, treat with drops")).toBe(
			"Why treat the left eye as well?",
		);
	});
});

describe("speakFinding", () => {
	it("speaks an available finding with eye, value, and method", () => {
		const finding: CaseFinding = {
			id: "iop_right",
			eye: "right",
			name: "Intraocular pressure",
			aliases: [],
			available: true,
			value: "58 mmHg",
			method: "Goldmann applanation, 23:55",
			unavailableReason: null,
		};
		expect(speakFinding(finding)).toBe(
			"Right Intraocular pressure is 58 mmHg, recorded by Goldmann applanation, 23:55.",
		);
	});

	it("speaks an unavailable finding with the reason", () => {
		const finding: CaseFinding = {
			id: "gonio_right",
			eye: "right",
			name: "Gonioscopy",
			aliases: [],
			available: false,
			value: null,
			method: "Goldmann 3-mirror",
			unavailableReason: "No view: corneal oedema",
		};
		expect(speakFinding(finding)).toBe(
			"Right Gonioscopy is not available. No view: corneal oedema",
		);
	});
});

describe("lookupFinding", () => {
	it("refuses a diagnosis request", () => {
		const result = lookupFinding("What is the diagnosis?");
		expect(result.kind).toBe("missing");
		expect(result.spoken).toContain("I will not give the diagnosis");
	});

	it("returns a spoken available finding", () => {
		const result = lookupFinding(
			"intraocular pressure",
			"right intraocular pressure",
		);
		expect(result.kind).toBe("finding");
		if (result.kind !== "finding") return;
		expect(result.spoken).toBe(
			"Right Intraocular pressure is 58 mmHg, recorded by Goldmann applanation, 23:55.",
		);
	});

	it("returns an unavailable finding sentence", () => {
		const result = lookupFinding("gonioscopy", "right gonioscopy");
		expect(result.kind).toBe("finding");
		if (result.kind !== "finding") return;
		expect(result.spoken).toBe(
			"Right Gonioscopy is not available. No view: corneal oedema",
		);
	});

	it("asks which eye when the side is missing", () => {
		const result = lookupFinding("visual acuity");
		expect(result).toEqual({
			kind: "clarify",
			spoken: "Do you want the right visual acuity or the left?",
		});
	});

	it("asks which eye for a whole-eye request without a side", () => {
		const result = lookupFinding("all findings for the eye");
		expect(result.kind).toBe("clarify");
		expect(result.spoken).toContain("right eye or the left");
	});

	it("returns a missing finding when nothing matches", () => {
		const result = lookupFinding("serum copper");
		expect(result).toEqual({
			kind: "missing",
			spoken: "That finding was not recorded. I can't give you a value for it.",
		});
	});

	it("looks up history without an eye", () => {
		const result = lookupFinding("allergies");
		expect(result.kind).toBe("finding");
		if (result.kind !== "finding") return;
		expect(result.spoken).toContain("Sulfonamide");
	});
});

describe("asksForWholeEye", () => {
	it("detects broad examination requests", () => {
		expect(asksForWholeEye("all findings in the right eye")).toBe(true);
		expect(asksForWholeEye("right intraocular pressure")).toBe(false);
	});
});
