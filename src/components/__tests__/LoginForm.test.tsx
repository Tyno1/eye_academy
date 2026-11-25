import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "#/components/LoginForm";

const push = vi.fn();
const invalidate = vi.fn();
const signInMock = vi.fn();
const establishSessionMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		children,
		className,
	}: {
		to: string;
		children: ReactNode;
		className?: string;
	}) => (
		<a href={to} className={className}>
			{children}
		</a>
	),
	useRouter: () => ({
		invalidate,
		history: { push },
	}),
}));

vi.mock("firebase/auth", () => ({
	signInWithEmailAndPassword: (...args: unknown[]) => signInMock(...args),
}));

vi.mock("#/lib/firebase", () => ({
	auth: { name: "auth" },
}));

vi.mock("#/server/session", () => ({
	establishSession: (...args: unknown[]) => establishSessionMock(...args),
}));

describe("LoginForm", () => {
	beforeEach(() => {
		push.mockReset();
		invalidate.mockReset();
		signInMock.mockReset();
		establishSessionMock.mockReset();
	});

	it("renders the login fields and register link", () => {
		render(<LoginForm />);
		expect(screen.getByText("Login")).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
			"href",
			"/register",
		);
	});

	it("shows validation errors for empty fields", async () => {
		const user = userEvent.setup();
		render(<LoginForm />);
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(await screen.findAllByRole("alert")).toHaveLength(2);
		expect(signInMock).not.toHaveBeenCalled();
	});

	it("signs in and redirects on valid credentials", async () => {
		const user = userEvent.setup();
		const firebaseUser = { uid: "u1", email: "a@b.com" };
		signInMock.mockResolvedValue({ user: firebaseUser });
		establishSessionMock.mockResolvedValue(undefined);
		invalidate.mockResolvedValue(undefined);

		render(<LoginForm redirectTo="/viva" />);
		await user.type(screen.getByLabelText("Email"), "a@b.com");
		await user.type(screen.getByLabelText("Password"), "secret");
		await user.click(screen.getByRole("button", { name: "Sign in" }));

		await waitFor(() => {
			expect(signInMock).toHaveBeenCalledWith(
				{ name: "auth" },
				"a@b.com",
				"secret",
			);
		});
		expect(establishSessionMock).toHaveBeenCalledWith(firebaseUser);
		expect(invalidate).toHaveBeenCalledOnce();
		expect(push).toHaveBeenCalledWith("/viva");
	});

	it("shows an auth error when sign-in fails", async () => {
		const user = userEvent.setup();
		signInMock.mockRejectedValue(new Error("bad"));

		render(<LoginForm />);
		await user.type(screen.getByLabelText("Email"), "a@b.com");
		await user.type(screen.getByLabelText("Password"), "secret");
		await user.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Could not sign in.",
		);
		expect(push).not.toHaveBeenCalled();
	});
});
