"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoader } from "@repo/ui/page-loader";
import { useMe } from "@/features/auth/hooks";
import { useSession, useSessionHydrated } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";

/** The console is admins only: no session, an ended one, or a non-admin → sign in, coming back here after. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const hydrated = useSessionHydrated();
	const token = useSession((state) => state.token);
	const clear = useSession((state) => state.clear);
	const me = useMe(hydrated);

	const denied =
		hydrated &&
		(!token ||
			(me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403)) ||
			me.data?.role === "user");

	useEffect(() => {
		if (!denied) return;
		clear();
		router.replace(pathname && pathname !== "/" ? `/sign-in?next=${encodeURIComponent(pathname)}` : "/sign-in");
	}, [denied, clear, router, pathname]);

	if (hydrated && token && me.error && !denied) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
				<p className="text-lg font-medium">We can’t reach the Saji API</p>
				<p className="max-w-sm text-sm text-ink-muted">{me.error.message}</p>
				<button type="button" onClick={() => void me.refetch()} className="rounded-full bg-primary px-6 py-2.5 text-white">
					Try again
				</button>
			</div>
		);
	}
	if (!hydrated || denied || !me.data) return <PageLoader />;
	return <>{children}</>;
}
