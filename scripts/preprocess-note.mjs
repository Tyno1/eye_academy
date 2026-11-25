import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const pdf = process.argv[2];
if (!pdf) {
	console.error("Usage: node scripts/preprocess-note.mjs <note.pdf>");
	process.exit(1);
}

try {
	execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
} catch {
	console.error("pdftotext is required. Install poppler, then run this script again.");
	process.exit(1);
}

const pageCount = 10;
const chunks = [];
for (let page = 1; page <= pageCount; page += 1) {
	const text = execFileSync(
		"pdftotext",
		["-f", String(page), "-l", String(page), "-layout", pdf, "-"],
		{ encoding: "utf8" },
	);
	chunks.push({
		page,
		text: text
			.replace(/eyeacademy\s+Take-home reference note/g, "")
			.replace(/Glaucoma and angle closure · Eye Academy reference note\s+\d+/g, "")
			.replace(/\s+\n/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim(),
	});
}

const output = resolve("data/note_chunks.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(chunks, null, "\t")}\n`);
console.log(`Wrote ${chunks.length} pages to ${output}`);
