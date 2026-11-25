import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
const clearSession = vi.fn();
const establishSession = vi.fn();
const firebaseSignOut = vi.fn();
let authListener: ((user: { uid: string; email: string } | null) => void) | null =
	null;

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ invalidate }),
	useRouteContext: () => ({ session: mockSession }),
}));

vi.mock("firebase/auth", () => ({
	onAuthStateChanged: (
		_auth: unknown,
		listener: (user: { uid: string; email: string } | null) => void,
	) => {
		authListener = listener;
		return () => {
			authListener = null;
		};
	},
	signOut: (...args: unknown[]) => firebaseSignOut(...args),
}));

vi.mock("#/lib/firebase", () => ({
	auth: { name: "auth" },
}));

vi.mock("#/server/session", () => ({
	clearSession: (...args: unknown[]) => clearSession(...args),
	establishSession: (...args: unknown[]) => establishSession(...args),
}));

let mockSession: { uid: string; email: string } | null = null;

describe("auth-context", () => {
	beforeEach(() => {
		invalidate.mockReset();
		clearSession.mockReset();
		establishSession.mockReset();
		firebaseSignOut.mockReset();
		authListener = null;
		mockSession = null;
		vi.resetModules();
	});

	it("throws when useAuth is used outside the provider", async () => {
		const { useAuth } = await import("#/providers/auth-context");
		function Probe() {
			useAuth();
			return null;
		}
		expect(() => render(<Probe />)).toThrow(
			"useAuth must be used within AuthProvider",
		);
	});

	it("tracks Firebase auth state and signs out", async () => {
		const user = userEvent.setup();
		const { AuthProvider, useAuth } = await import("#/providers/auth-context");

		function Probe() {
			const auth = useAuth();
			return (
				<div>
					<span>{auth.loading ? "loading" : "ready"}</span>
					<span>{auth.signedIn ? "signed-in" : "signed-out"}</span>
					<span>{auth.email ?? "none"}</span>
					<button type="button" onClick={() => void auth.signOut()}>
						Sign out
					</button>
				</div>
			);
		}

		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);

		expect(screen.getByText("loading")).toBeInTheDocument();

		establishSession.mockResolvedValue(undefined);
		invalidate.mockResolvedValue(undefined);

		await act(async () => {
			authListener?.({ uid: "u1", email: "trainee@example.com" });
		});

		await waitFor(() => {
			expect(screen.getByText("ready")).toBeInTheDocument();
		});
		expect(screen.getByText("signed-in")).toBeInTheDocument();
		expect(screen.getByText("trainee@example.com")).toBeInTheDocument();
		expect(establishSession).toHaveBeenCalled();

		clearSession.mockResolvedValue(undefined);
		firebaseSignOut.mockResolvedValue(undefined);
		await user.click(screen.getByRole("button", { name: "Sign out" }));

		expect(clearSession).toHaveBeenCalledOnce();
		expect(firebaseSignOut).toHaveBeenCalledOnce();
		expect(invalidate).toHaveBeenCalled();
	});

	it("treats a server session as signed in", async () => {
		mockSession = { uid: "u2", email: "session@example.com" };
		const { AuthProvider, useAuth } = await import("#/providers/auth-context");

		function Probe() {
			const auth = useAuth();
			return (
				<div>
					<span>{auth.signedIn ? "signed-in" : "signed-out"}</span>
					<span>{auth.email ?? "none"}</span>
				</div>
			);
		}

		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);

		await act(async () => {
			authListener?.(null);
		});

		await waitFor(() => {
			expect(screen.getByText("signed-in")).toBeInTheDocument();
		});
		expect(screen.getByText("session@example.com")).toBeInTheDocument();
	});
});
