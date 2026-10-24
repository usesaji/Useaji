"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HiOutlineCheck } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/form";
import { InputField } from "@repo/ui/input-field";
import { LinkButton } from "@/components/LinkButton";
import { errorMessage, useResetPassword } from "@/features/auth/hooks";
import { ResetPasswordSchema, type ResetPasswordValues } from "@/features/auth/schema";
import { pageRoutes } from "@/lib/routes";

/**
 * The emailed link carries `#email=…&token=…` in the fragment, which never reaches a server. It's
 * read once, then removed from the address bar at once (before any third-party script can see it,
 * as the API asks); the values stay in memory for the form.
 */
let captured: string | null = null;
const noop = () => () => {};
const readHash = () => {
	if (captured === null) {
		captured = window.location.hash;
		if (captured) window.history.replaceState(null, "", window.location.pathname + window.location.search);
	}
	return captured;
};

/** Set a new password from the emailed link (`POST /auth/password/reset`). */
export function ResetPasswordForm() {
	const hash = useSyncExternalStore(noop, readHash, () => null);
	const params = new URLSearchParams((hash ?? "").replace(/^#/, ""));
	const email = params.get("email");
	const token = params.get("token");
	const reset = useResetPassword();
	const form = useForm<ResetPasswordValues>({
		resolver: zodResolver(ResetPasswordSchema),
		mode: "onChange",
		defaultValues: { password: "", confirmPassword: "" },
	});

	if (hash === null) return null;

	if (reset.isSuccess) {
		return (
			<div className="animate-rise text-center lg:text-start">
				<span className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-white lg:mx-0">
					<HiOutlineCheck />
				</span>
				<h2 className="mt-6 text-[30px]">Password reset</h2>
				<p className="mt-1 text-sm">You&apos;ve been signed out everywhere. Sign in with your new password.</p>
				<LinkButton href={pageRoutes.authRoutes.LOGIN} className="mt-8 w-full">
					Sign in
				</LinkButton>
			</div>
		);
	}

	if (!email || !token) {
		return (
			<div className="text-center lg:text-start">
				<h2 className="text-[30px]">This link is incomplete</h2>
				<p className="mt-1 text-sm">Open the link from the email again, or ask for a new one.</p>
				<LinkButton href={pageRoutes.authRoutes.FORGOT_PASSWORD} className="mt-8 w-full">
					Send a new link
				</LinkButton>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-7 text-center lg:text-start">
				<h2 className="text-[30px]">Set a new password</h2>
				<p className="text-sm">
					For <span className="font-medium">{email}</span>
				</p>
			</div>
			<Form {...form}>
				<form
					noValidate
					onSubmit={form.handleSubmit(({ password }) => reset.mutate({ email, token, newPassword: password }))}
					className="my-5 space-y-5"
				>
					<FormField
						control={form.control}
						name="password"
						render={({ field, fieldState }) => (
							<FormItem>
								<FormControl>
									<InputField
										{...field}
										label="New password"
										type="password"
										autoComplete="new-password"
										error={fieldState.error?.message}
									/>
								</FormControl>
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field, fieldState }) => (
							<FormItem>
								<FormControl>
									<InputField
										{...field}
										label="Confirm new password"
										type="password"
										autoComplete="new-password"
										error={fieldState.error?.message}
									/>
								</FormControl>
							</FormItem>
						)}
					/>
					{reset.error && (
						<p role="alert" className="animate-drop rounded-xl bg-accent-light px-4 py-3 text-sm text-accent">
							{errorMessage(reset.error)}{" "}
							<Link href={pageRoutes.authRoutes.FORGOT_PASSWORD} className="font-medium underline">
								Get a new link
							</Link>
						</p>
					)}
					<Button type="submit" isLoading={reset.isPending} disabled={!form.formState.isValid} className="w-full">
						Reset password
					</Button>
				</form>
			</Form>
		</div>
	);
}
