import { Link, useRouter } from "@tanstack/react-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

const registerSchema = z
	.object({
		email: z.email("Enter a valid email."),
		password: z.string().min(6, "Password must be at least 6 characters."),
		confirmPassword: z.string().min(1, "Confirm your password."),
	})
	.refine((values) => values.password === values.confirmPassword, {
		message: "Passwords do not match.",
		path: ["confirmPassword"],
	});

type FieldName = keyof z.infer<typeof registerSchema>;

type FieldErrors = Partial<Record<FieldName, string>>;

function errorsFrom(
	error: z.ZodError<z.infer<typeof registerSchema>>,
): FieldErrors {
	const { fieldErrors } = z.flattenError(error);
	return {
		email: fieldErrors.email?.[0],
		password: fieldErrors.password?.[0],
		confirmPassword: fieldErrors.confirmPassword?.[0],
	};
}

export default function RegisterForm({ redirectTo }: { redirectTo?: string }) {
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
		const result = registerSchema.safeParse({
			email: data.get("email"),
			password: data.get("password"),
			confirmPassword: data.get("confirmPassword"),
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
			const credential = await createUserWithEmailAndPassword(
				auth,
				result.data.email,
				result.data.password,
			);
			await establishSession(credential.user);
			await router.invalidate();
			router.history.push(safePath(redirectTo));
		} catch (error) {
			setFormError(authMessage(error, "Could not create the account."));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
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
							autoComplete="new-password"
							aria-invalid={fieldErrors.password ? true : undefined}
							onChange={() => clearFieldError("password")}
						/>
						{fieldErrors.password ? (
							<p role="alert" className="text-sm text-destructive">
								{fieldErrors.password}
							</p>
						) : null}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="confirm-password">Confirm password</Label>
						<Input
							id="confirm-password"
							name="confirmPassword"
							type="password"
							autoComplete="new-password"
							aria-invalid={fieldErrors.confirmPassword ? true : undefined}
							onChange={() => clearFieldError("confirmPassword")}
						/>
						{fieldErrors.confirmPassword ? (
							<p role="alert" className="text-sm text-destructive">
								{fieldErrors.confirmPassword}
							</p>
						) : null}
					</div>
					{formError ? (
						<p role="alert" className="text-sm text-destructive">
							{formError}
						</p>
					) : null}
					<Button type="submit" className="w-full" disabled={pending}>
						{pending ? "Creating account..." : "Create account"}
					</Button>
				</form>
			</CardContent>
			<CardFooter className="justify-center">
				<p className="text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link
						to="/login"
						search={{ redirect: redirectTo }}
						className="text-primary underline-offset-4 hover:underline"
					>
						Sign in
					</Link>
				</p>
			</CardFooter>
		</Card>
	);
}
