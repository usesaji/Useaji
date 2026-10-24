import type { Metadata } from "next";
import { Suspense } from "react";
import { PicSlide } from "@/features/auth/components/PicSlide";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = { title: "Get Started" };

export default function Page() {
	return (
		<div className="custom-container flex w-full flex-col gap-10 lg:flex-row lg:items-center lg:gap-20">
			<div className="lg:flex-1">
				<PicSlide />
			</div>
			<div className="mx-auto w-full max-w-lg lg:flex-1">
				<Suspense>
					<RegisterForm />
				</Suspense>
			</div>
		</div>
	);
}
