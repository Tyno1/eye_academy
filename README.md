# Eye Academy

A local voice viva for the fictional case EA-VIVA-001. Sign in, open an attempt, and ask for findings. The examiner speaks only what the case file returns.

## Run

```bash
npm install
```

Copy `.env.example` to `.env` and set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `OPENAI_API_KEY`.

```bash
npm run dev
```

Open http://localhost:3000, create an account, then choose **Your vivas** and **New viva**. Allow the microphone. **Stop recording** ends the microphone and waits for the answer already in progress.

Firestore rules are in `firestore.rules`. The server writes attempts with the Admin SDK. A signed-in user can read only their own attempts.

## Models

The spoken examiner is `gpt-realtime-2.1-mini`. Hearing uses `gpt-4o-mini-transcribe`. The revision point uses `gpt-4o-mini`, and the excerpt is kept only when it is copied from the cited page.

An alternative for the spoken examiner is an ElevenLabs agent with a client tool that calls the same finding lookup. That path is not wired up. The revision step would stay on a small text model.

A finding turn is the pause after the question until the tool sentence is spoken. The case lookup itself, measured locally on 24 November 2026, returned in under 1 ms. A full voice turn has not been timed. The wait in the viva is the realtime model, not the lookup.

## What the examiner may say

Clinical answers come from `src/case/findings.ts`. The model is told to call `getFinding` and say only that text. A request for the diagnosis returns a refusal. The diagnosis stays in the case file and is not given to the model.

## Checks

Available finding.

- Expected: Right Intraocular pressure is 58 mmHg, recorded by Goldmann applanation, 23:55.
- Observed in a spoken viva on 25 November 2026: the same sentence.

Unavailable finding.

- Expected: Right Gonioscopy is not available. No view: corneal oedema
- Observed in a spoken viva on 25 November 2026: the same sentence.

Diagnosis.

- Expected: the examiner does not diagnose.
- Observed in a spoken viva on 25 November 2026: I will not give the diagnosis. Tell me your diagnosis and your immediate management.

Follow-up. After the trainee states a diagnosis and plan, the examiner asks one of these, then ends the viva:

- Why treat the left eye as well?
- Why might pilocarpine not work at first when the pressure is very high?
- What would you do if the pressure doesn't come down?

Observed in a spoken viva on 25 November 2026. The trainee said this was acute angle closure in the right eye and that they would lower the pressure and do a laser iridotomy in both eyes. The examiner asked “Why treat the left eye as well?” The trainee answered. The examiner said “The viva is complete.”

The revision button appears once the attempt has ended. A cited revision point has not been produced in a completed viva yet.

## Left out

No deployment. The diagnosis is not marked right or wrong. There is one case. `data/note_chunks.json` was prepared by hand; `node scripts/preprocess-note.mjs <note.pdf>` rebuilds it when `pdftotext` is installed.

One check was corrected after a spoken viva. The examiner closed a diagnosis with “Viva is complete—thank you for sharing your answer.” That is not one of the three follow-ups. The next viva asked “Why treat the left eye as well?” and, after the answer, said only “The viva is complete.”
