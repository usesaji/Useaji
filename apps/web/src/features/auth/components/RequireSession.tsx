"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@repo/ui/page-loader";
import { useAccount } from "@/features/auth/hooks";
import { useSession, useSessionHydrated } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";
import { pageRoutes } from "@/lib/routes";
import { safeNextPath } from "@/lib/next-path";

/**
 * Gate for signed-in pages: no session (or a 401 loading the account) → log in, coming back here
 * afterwards; no profile yet → Create Profile. `profile={false}` is for Create Profile itself.
 */
export function RequireSession({ children, profile = true }: { children: React.ReactNode; profile?: boolean }) {
	const router = useRouter();
	const hydrated = useSessionHydrated();
	const token = useSession((state) => state.token);
	const clear = useSession((state) => state.clear);
	const { data: account, error, isLoading, refetch } = useAccount(hydrated);

	// Only an unauthenticated answer ends the session; a network or server error offers a retry.
	const signedOut = hydrated && (!token || (error instanceof ApiError && error.status === 401));
	const unreachable = hydrated && Boolean(token) && Boolean(error) && !signedOut && !account;
	const needsProfile = profile && account && !account.profile;

	useEffect(() => {
		if (!signedOut) return;
		clear();
		const here = `${window.location.pathname}${window.location.search}`.replace(process.env.NEXT_PUBLIC_BASE_PATH ?? "", "") || "/";
		const next = safeNextPath(here);
		router.replace(next ? `${pageRoutes.authRoutes.LOGIN}?next=${encodeURIComponent(next)}` : pageRoutes.authRoutes.LOGIN);
	}, [signedOut, clear, router]);

	useEffect(() => {
		if (needsProfile) router.replace(pageRoutes.authRoutes.CREATE_PROFILE);
	}, [needsProfile, router]);

	if (unreachable) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
				<p className="text-lg font-medium">We can’t reach Saji right now</p>
				<p className="max-w-sm text-sm font-light text-ink-muted">{error instanceof Error ? error.message : "Check your connection and try again."}</p>
				<button type="button" onClick={() => void refetch()} className="rounded-full bg-primary px-6 py-2.5 text-white">
					Try again
				</button>
			</div>
		);
	}
	if (!hydrated || signedOut || isLoading || needsProfile || !account) return <PageLoader />;
	return <>{children}</>;
}
