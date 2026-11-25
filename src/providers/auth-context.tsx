import { useRouteContext, useRouter } from "@tanstack/react-router";
import {
	signOut as firebaseSignOut,
	onAuthStateChanged,
	type User,
} from "firebase/auth";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { auth } from "#/lib/firebase";
import { clearSession, establishSession } from "#/server/session";

type AuthContextValue = {
	user: User | null;
	email: string | null;
	loading: boolean;
	signedIn: boolean;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { session } = useRouteContext({ from: "__root__" });
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const attempted = useRef<string | null>(null);

	useEffect(() => {
		return onAuthStateChanged(auth, (firebaseUser) => {
			setUser(firebaseUser);
			setLoading(false);
		});
	}, []);

	useEffect(() => {
		if (loading || !user || session) return;
		if (attempted.current === user.uid) return;
		attempted.current = user.uid;

		void establishSession(user)
			.then(() => router.invalidate())
			.catch(() => {
				attempted.current = null;
			});
	}, [loading, user, session, router]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			email: user?.email ?? session?.email ?? null,
			loading,
			signedIn: Boolean(user) || session !== null,
			signOut: async () => {
				await clearSession();
				await firebaseSignOut(auth);
				await router.invalidate();
			},
		}),
		[user, session, loading, router],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const value = useContext(AuthContext);
	if (!value) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return value;
}
