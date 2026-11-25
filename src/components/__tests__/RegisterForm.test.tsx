import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterForm from "#/components/RegisterForm";

const push = vi.fn();
const invalidate = vi.fn();
const createUserMock = vi.fn();
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
	createUserWithEmailAndPassword: (...args: unknown[]) => createUserMock(...args),
}));

vi.mock("#/lib/firebase", () => ({
	auth: { name: "auth" },
}));

vi.mock("#/server/session", () => ({
	establishSession: (...args: unknown[]) => establishSessionMock(...args),
}));

describe("RegisterForm", () => {
	beforeEach(() => {
		push.mockReset();
		invalidate.mockReset();
		createUserMock.mockReset();
		establishSessionMock.mockReset();
	});

	it("renders the register fields and sign-in link", () => {
		render(<RegisterForm />);
		expect(screen.getByText("Create an account")).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toBeInTheDocument();
		expect(screen.getByLabelText("Password")).toBeInTheDocument();
		expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/login",
		);
	});

	it("shows a mismatch error when passwords differ", async () => {
		const user = userEvent.setup();
		render(<RegisterForm />);
		await user.type(screen.getByLabelText("Email"), "a@b.com");
		await user.type(screen.getByLabelText("Password"), "secret1");
		await user.type(screen.getByLabelText("Confirm password"), "secret2");
		await user.click(screen.getByRole("button", { name: "Create account" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Passwords do not match.",
		);
		expect(createUserMock).not.toHaveBeenCalled();
	});

	it("creates an account and redirects", async () => {
		const user = userEvent.setup();
		const firebaseUser = { uid: "u2", email: "new@b.com" };
		createUserMock.mockResolvedValue({ user: firebaseUser });
		establishSessionMock.mockResolvedValue(undefined);
		invalidate.mockResolvedValue(undefined);

		render(<RegisterForm redirectTo="/viva" />);
		await user.type(screen.getByLabelText("Email"), "new@b.com");
		await user.type(screen.getByLabelText("Password"), "secret1");
		await user.type(screen.getByLabelText("Confirm password"), "secret1");
		await user.click(screen.getByRole("button", { name: "Create account" }));

		await waitFor(() => {
			expect(createUserMock).toHaveBeenCalledWith(
				{ name: "auth" },
				"new@b.com",
				"secret1",
			);
		});
		expect(establishSessionMock).toHaveBeenCalledWith(firebaseUser);
		expect(push).toHaveBeenCalledWith("/viva");
	});

	it("shows an auth error when registration fails", async () => {
		const user = userEvent.setup();
		createUserMock.mockRejectedValue(new Error("taken"));

		render(<RegisterForm />);
		await user.type(screen.getByLabelText("Email"), "a@b.com");
		await user.type(screen.getByLabelText("Password"), "secret1");
		await user.type(screen.getByLabelText("Confirm password"), "secret1");
		await user.click(screen.getByRole("button", { name: "Create account" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Could not create the account.",
		);
		expect(push).not.toHaveBeenCalled();
	});
});
