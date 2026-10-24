"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/form";
import { InputField } from "@repo/ui/input-field";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { useLogin } from "@/features/auth/hooks";
import { SignInSchema, type SignInValues } from "@/features/auth/schema";
import { useNextPath, appendNext } from "@/lib/next-path";
import { pageRoutes } from "@/lib/routes";

export function LoginForm() {
	const { mutate, isPending } = useLogin();
	const next = useNextPath();
	const form = useForm<SignInValues>({
		resolver: zodResolver(SignInSchema),
		mode: "onChange",
		defaultValues: { email: "", password: "" },
	});

	return (
		<div>
			<div className="mb-7 text-center lg:text-start">
				<h2 className="text-[30px]">Welcome Back</h2>
				<p className="text-sm">Enter your credentials to sign in</p>
			</div>

			<Form {...form}>
				<form noValidate onSubmit={form.handleSubmit((values) => mutate(values))} className="my-5 space-y-5">
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
									<InputField {...field} label="Password" placeholder="Password" type="password" autoComplete="current-password" error={fieldState.error?.message} />
								</FormControl>
							</FormItem>
						)}
					/>
					<div className="-mt-2 text-right">
						<Link href={pageRoutes.authRoutes.FORGOT_PASSWORD} className="text-xs text-primary underline-offset-4 hover:underline">
							Forgot password?
						</Link>
					</div>
					<Button type="submit" isLoading={isPending} disabled={!form.formState.isValid} className="w-full">
						Continue
					</Button>
				</form>
			</Form>

			<GoogleButton />

			<p className="mt-6 text-center text-sm font-light">
				Don&apos;t have an account?{" "}
				<Link className="font-medium" href={appendNext(pageRoutes.authRoutes.REGISTER, next)}>
					Sign Up
				</Link>
			</p>
		</div>
	);
}
