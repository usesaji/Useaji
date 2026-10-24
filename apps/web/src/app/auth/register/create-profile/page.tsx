import type { Metadata } from "next";
import { CreateProfileForm } from "@/features/auth/components/CreateProfileForm";
import { RequireSession } from "@/features/auth/components/RequireSession";

export const metadata: Metadata = { title: "Create Profile" };

export default function Page() {
	return (
		<RequireSession profile={false}>
			<div className="custom-container w-full">
				<div className="mx-auto w-full max-w-lg">
					<CreateProfileForm />
				</div>
			</div>
		</RequireSession>
	);
}
