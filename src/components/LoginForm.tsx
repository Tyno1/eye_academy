import { Link, useRouter } from "@tanstack/react-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authMessage } from "#/lib/auth-message";
import { safePath } from "#/lib/auth-search";
import { auth } from "#/lib/firebase";
import { establishSession } from "#/server/session";

const loginSchema = z.object({
	email: z.email("Enter a valid email."),
	password: z.string().min(1, "Password is required."),
});

type FieldName = keyof z.infer<typeof loginSchema>;

type FieldErrors = Partial<Record<FieldName, string>>;

function errorsFrom(
	error: z.ZodError<z.infer<typeof loginSchema>>,
): FieldErrors {
	const { fieldErrors } = z.flattenError(error);
	return {
		email: fieldErrors.email?.[0],
		password: fieldErrors.password?.[0],
	};
}

export default function LoginForm({ redirectTo }: { redirectTo?: string }) {
	const router = useRouter();
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	function clearFieldError(field: FieldName) {
		setFieldErrors((current) => {
			if (!current[field]) return current;
			const next = { ...current };
			delete next[field];
			return next;
		});
	}

	async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const result = loginSchema.safeParse({
			email: data.get("email"),
			password: data.get("password"),
		});

		if (!result.success) {
			setFieldErrors(errorsFrom(result.error));
			setFormError(null);
			return;
		}

		setFieldErrors({});
		setFormError(null);
		setPending(true);
		try {
			const credential = await signInWithEmailAndPassword(
				auth,
				result.data.email,
				result.data.password,
			);
			await establishSession(credential.user);
			await router.invalidate();
			router.history.push(safePath(redirectTo));
		} catch (error) {
			setFormError(authMessage(error, "Could not sign in."));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Login</CardTitle>
				<CardDescription>Enter your email and password.</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="grid gap-4" noValidate onSubmit={handleSubmit}>
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							aria-invalid={fieldErrors.email ? true : undefined}
							onChange={() => clearFieldError("email")}
						/>
						{fieldErrors.email ? (
							<p role="alert" className="text-sm text-destructive">
								{fieldErrors.email}
							</p>
						) : null}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							aria-invalid={fieldErrors.password ? true : undefined}
							onChange={() => clearFieldError("password")}
						/>
						{fieldErrors.password ? (
							<p role="alert" className="text-sm text-destructive">
								{fieldErrors.password}
							</p>
						) : null}
					</div>
					{formError ? (
						<p role="alert" className="text-sm text-destructive">
							{formError}
						</p>
					) : null}
					<Button type="submit" className="w-full" disabled={pending}>
						{pending ? "Signing in..." : "Sign in"}
					</Button>
				</form>
			</CardContent>
			<CardFooter className="justify-center">
				<p className="text-sm text-muted-foreground">
					Need an account?{" "}
					<Link
						to="/register"
						search={{ redirect: redirectTo }}
						className="text-primary underline-offset-4 hover:underline"
					>
						Register
					</Link>
				</p>
			</CardFooter>
		</Card>
	);
}
