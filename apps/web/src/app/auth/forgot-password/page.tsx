import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
	return (
		<div className="custom-container w-full">
			<div className="mx-auto w-full max-w-lg">
				<ForgotPasswordForm />
			</div>
		</div>
	);
}
