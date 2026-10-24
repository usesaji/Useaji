"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@repo/ui/logo";
import { LinkButton } from "@/components/LinkButton";
import { pageRoutes } from "@/lib/routes";
import { LANDING_URL } from "@/lib/site";

/** The auth pages' bar: logo home to the landing site, and the other auth action. */
export function AuthHeader() {
	const pathname = usePathname();
	const onLogin = pathname.startsWith(pageRoutes.authRoutes.LOGIN);

	return (
		<header className="fixed inset-x-0 top-0 z-40 bg-white py-5 sm:py-8 lg:px-10 xl:px-20">
			<div className="custom-container flex items-center justify-between">
				<a href={LANDING_URL} aria-label="Saji home">
					<Logo />
				</a>
				{onLogin ? (
					<LinkButton href={pageRoutes.authRoutes.REGISTER}>Get Started</LinkButton>
				) : (
					<LinkButton href={pageRoutes.authRoutes.LOGIN} variant="secondary">
						Log In
					</LinkButton>
				)}
			</div>
		</header>
	);
}
