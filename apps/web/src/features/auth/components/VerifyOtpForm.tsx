"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@repo/ui/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui/input-otp";
import { useResendSignupCode, useVerifySignup } from "@/features/auth/hooks";
import { VerifyOtpSchema, type VerifyOtpValues } from "@/features/auth/schema";
import { signupSession } from "@/features/auth/signup-session";
import { formatCountdown } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

/** Step 2 of 3: the emailed code. Verifying creates the account and signs it in. */
export function VerifyOtpForm() {
	const router = useRouter();
	const verify = useVerifySignup();
	const resend = useResendSignupCode();
	const now = useNow(1000);
	const form = useForm<VerifyOtpValues>({ resolver: zodResolver(VerifyOtpSchema), mode: "onChange", defaultValues: { otp: "" } });

	// Without the pending sign-up (another tab, or it ended) there is nothing to verify.
	useEffect(() => {
		if (!signupSession.get()) router.replace(pageRoutes.authRoutes.REGISTER);
	}, [router]);

	const resendAt = now ? (signupSession.get()?.resendAt ?? 0) : 0;
	const wait = Math.ceil((resendAt - now) / 1000);

	return (
		<Form {...form}>
			<form noValidate onSubmit={form.handleSubmit(({ otp }) => verify.mutate(otp))} className="space-y-8">
				<FormField
					control={form.control}
					name="otp"
					render={({ field }) => (
						<FormItem className="flex flex-col items-center">
							<FormControl>
								<InputOTP maxLength={4} {...field} autoFocus>
									<InputOTPGroup className="gap-3">
										{[0, 1, 2, 3].map((i) => (
											<InputOTPSlot key={i} index={i} className="h-14 w-14 rounded-xl" />
										))}
									</InputOTPGroup>
								</InputOTP>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit" className="w-full" disabled={!form.formState.isValid} isLoading={verify.isPending}>
					Verify OTP
				</Button>

				<p className="text-center text-sm">
					Didn&apos;t receive the code?{" "}
					<button
						type="button"
						onClick={() => resend.mutate(undefined, { onSuccess: () => form.reset({ otp: "" }) })}
						disabled={resend.isPending || wait > 0}
						className="font-medium underline disabled:no-underline disabled:opacity-50"
					>
						{resend.isPending ? "Sending…" : wait > 0 ? `Resend in ${formatCountdown(wait)}` : "Resend OTP"}
					</button>
				</p>
			</form>
		</Form>
	);
}
