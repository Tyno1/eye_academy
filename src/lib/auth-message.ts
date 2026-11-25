import { FirebaseError } from "firebase/app";

const authMessages: Record<string, string> = {
	"auth/email-already-in-use": "That email is already registered.",
	"auth/invalid-email": "Enter a valid email.",
	"auth/invalid-credential": "Email or password is incorrect.",
	"auth/user-not-found": "Email or password is incorrect.",
	"auth/wrong-password": "Email or password is incorrect.",
	"auth/weak-password": "Password must be at least 6 characters.",
	"auth/user-disabled": "This account is disabled.",
	"auth/too-many-requests": "Too many attempts. Try again later.",
	"auth/network-request-failed": "Network error. Try again.",
};

export function authMessage(error: unknown, fallback: string) {
	if (
		error instanceof Error &&
		(error.message.startsWith("Firebase Admin") ||
			error.message === "Could not start the session.")
	) {
		return error.message;
	}
	if (!(error instanceof FirebaseError)) return fallback;
	return authMessages[error.code] ?? fallback;
}
