import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = { title: "Log In" };

export default function Page() {
	return (
		<div className="custom-container flex w-full flex-col gap-10 lg:flex-row lg:items-center lg:gap-20">
			<div className="lg:flex-1">
				<div className="h-70 sm:h-105">
					<Image
						src="/images/auth/login-illustration.svg"
						alt=""
						className="h-full w-full object-contain"
						width={500}
						height={500}
						priority
					/>
				</div>
			</div>
			<div className="mx-auto w-full max-w-lg lg:flex-1">
				<Suspense>
					<LoginForm />
				</Suspense>
			</div>
		</div>
	);
}
