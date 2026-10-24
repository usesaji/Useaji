"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/form";
import { InputField } from "@repo/ui/input-field";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { useRegister } from "@/features/auth/hooks";
import { SignUpSchema, type SignUpValues } from "@/features/auth/schema";
import { appendNext, useNextPath } from "@/lib/next-path";
import { pageRoutes } from "@/lib/routes";

/** Step 1 of 3: email and password (`POST /auth/signup` emails a code). */
export function RegisterForm() {
	const { mutate, isPending } = useRegister();
	const next = useNextPath();
	const form = useForm<SignUpValues>({
		resolver: zodResolver(SignUpSchema),
		mode: "onChange",
		defaultValues: { email: "", password: "", confirmPassword: "" },
	});

	return (
		<div>
			<div className="mb-7 text-center lg:text-start">
				<h2 className="text-[30px]">Get Started</h2>
				<p className="text-sm">Create your account with your email</p>
			</div>

			<Form {...form}>
				<form noValidate onSubmit={form.handleSubmit(({ email, password }) => mutate({ email, password }))} className="my-5 space-y-5">
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
					<FormField
						control={form.control}
						name="password"
						render={({ field, fieldState }) => (
							<FormItem>
								<FormControl>
									<InputField {...field} label="Password" placeholder="Create Password" type="password" autoComplete="new-password" error={fieldState.error?.message} />
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
									<InputField {...field} label="Confirm Password" placeholder="Confirm Password" type="password" autoComplete="new-password" error={fieldState.error?.message} />
								</FormControl>
							</FormItem>
						)}
					/>
					<Button type="submit" isLoading={isPending} disabled={!form.formState.isValid} className="w-full">
						Continue
					</Button>
				</form>
			</Form>

			<GoogleButton />

			<p className="mt-6 text-center text-sm font-light">
				Already have an Account?{" "}
				<Link className="font-medium" href={appendNext(pageRoutes.authRoutes.LOGIN, next)}>
					Sign In
				</Link>
			</p>
		</div>
	);
}
