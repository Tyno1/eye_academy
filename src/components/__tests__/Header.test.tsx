import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "#/components/Header";

const signOut = vi.fn();

const authState = {
	current: {
		email: null as string | null,
		signedIn: false,
		signOut,
	},
};

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
}));

vi.mock("../../providers/auth-context", () => ({
	useAuth: () => authState.current,
}));

vi.mock("../ThemeToggle", () => ({
	default: () => <button type="button">Theme</button>,
}));

describe("Header", () => {
	beforeEach(() => {
		signOut.mockReset();
		authState.current = {
			email: null,
			signedIn: false,
			signOut,
		};
	});

	it("shows login and register when signed out", () => {
		render(<Header />);
		expect(screen.getByRole("link", { name: /Eye Academy/ })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
			"href",
			"/login",
		);
		expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
			"href",
			"/register",
		);
		expect(screen.queryByRole("link", { name: "Viva" })).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Sign out/ }),
		).not.toBeInTheDocument();
	});

	it("shows viva, email, and sign out when signed in", async () => {
		const user = userEvent.setup();
		authState.current = {
			email: "trainee@example.com",
			signedIn: true,
			signOut,
		};
		render(<Header />);

		expect(screen.getByRole("link", { name: "Viva" })).toHaveAttribute(
			"href",
			"/viva",
		);
		expect(screen.getByText("trainee@example.com")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Sign out/ }));
		expect(signOut).toHaveBeenCalledOnce();
	});
});
