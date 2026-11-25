import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function adminApp() {
	const projectId = process.env.FIREBASE_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
	const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
	if (!projectId || !clientEmail || !privateKey) {
		throw new Error(
			"Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
		);
	}
	if (!getApps().length) {
		initializeApp({
			credential: cert({ projectId, clientEmail, privateKey }),
		});
	}
	return getAuth();
}

export function adminFirestore() {
	adminApp();
	return getFirestore();
}

export async function mintSessionCookie(idToken: string) {
	try {
		const cookie = await adminApp().createSessionCookie(idToken, {
			expiresIn: FIVE_DAYS_MS,
		});
		return { cookie, maxAge: FIVE_DAYS_MS / 1000 };
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.startsWith("Firebase Admin is not configured")
		) {
			throw error;
		}
		throw new Error("Could not start the session.");
	}
}

export async function readSessionCookie(sessionCookie: string) {
	try {
		const decoded = await adminApp().verifySessionCookie(sessionCookie, true);
		return { uid: decoded.uid, email: decoded.email ?? null };
	} catch {
		return null;
	}
}

export async function requireUser() {
	const { getCookie } = await import("@tanstack/react-start/server");
	const { SESSION_COOKIE } = await import("#/server/session");
	const cookie = getCookie(SESSION_COOKIE);
	if (!cookie) throw new Error("Sign in required.");
	const session = await readSessionCookie(cookie);
	if (!session) throw new Error("Sign in required.");
	return session;
}
