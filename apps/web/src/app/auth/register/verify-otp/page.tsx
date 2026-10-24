import type { Metadata } from "next";
import { VerifyOtpForm } from "@/features/auth/components/VerifyOtpForm";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyOtpPage({ searchParams }: PageProps<"/auth/register/verify-otp">) {
	const { email } = await searchParams;
	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-center px-4">
			<div className="mb-8 text-center">
				<h1 className="text-3xl font-semibold">Verify your email</h1>
				<p className="mt-2 text-ink-muted">
					Enter the 4-digit code sent to your email address{" "}
					<span className="text-primary">{typeof email === "string" ? email : ""}</span>.
				</p>
			</div>
			<VerifyOtpForm />
		</div>
	);
}
