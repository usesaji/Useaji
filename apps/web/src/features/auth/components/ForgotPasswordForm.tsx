"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HiOutlineEnvelope } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/form";
import { InputField } from "@repo/ui/input-field";
import { useForgotPassword } from "@/features/auth/hooks";
import { ForgotPasswordSchema, type ForgotPasswordValues } from "@/features/auth/schema";
import { pageRoutes } from "@/lib/routes";

/** "Forgot password": emails a reset link (`POST /auth/password/forgot`). */
export function ForgotPasswordForm() {
	const forgot = useForgotPassword();
	const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(ForgotPasswordSchema), mode: "onChange", defaultValues: { email: "" } });
	const sentTo = forgot.isSuccess ? forgot.variables : null;

	if (sentTo) {
		return (
			<div className="animate-rise text-center lg:text-start">
				<span className="animate-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-3xl text-primary lg:mx-0">
					<HiOutlineEnvelope />
				</span>
				<h2 className="mt-6 text-[30px]">Check your email</h2>
				<p className="mt-1 text-sm">
					If <span className="font-medium">{sentTo}</span> has a Saji account with a password, a reset link is on its way. It works once, and only the
					newest link works.
				</p>
				<p className="mt-4 text-xs font-light text-ink-muted">Signed up with Google? There&apos;s no password to reset — use “Continue with Google”.</p>
				<Button type="button" variant="soft" className="mt-6 w-full" isLoading={forgot.isPending} onClick={() => forgot.mutate(sentTo)}>
					Send it again
				</Button>
				<p className="mt-6 text-center text-sm font-light">
					<Link className="font-medium" href={pageRoutes.authRoutes.LOGIN}>
						Back to sign in
					</Link>
				</p>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-7 text-center lg:text-start">
				<h2 className="text-[30px]">Forgot your password?</h2>
				<p className="text-sm">Enter your email and we&apos;ll send you a link to set a new one.</p>
			</div>
			<Form {...form}>
				<form noValidate onSubmit={form.handleSubmit(({ email }) => forgot.mutate(email))} className="my-5 space-y-5">
					<FormField
						control={form.control}
						name="email"
						render={({ field, fieldState }) => (
							<FormItem>
								<FormControl>
									<InputField {...field} label="Email" placeholder="Email address" type="email" autoComplete="email" error={fieldState.error?.message} />
								</FormControl>
							</FormItem>
						)}
					/>
					<Button type="submit" isLoading={forgot.isPending} disabled={!form.formState.isValid} className="w-full">
						Send reset link
					</Button>
				</form>
			</Form>
			<p className="mt-6 text-center text-sm font-light">
				Remembered it?{" "}
				<Link className="font-medium" href={pageRoutes.authRoutes.LOGIN}>
					Sign in
				</Link>
			</p>
		</div>
	);
}
