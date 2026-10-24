import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function Page() {
	return (
		<div className="custom-container w-full">
			<div className="mx-auto w-full max-w-lg">
				<ResetPasswordForm />
			</div>
		</div>
	);
}
