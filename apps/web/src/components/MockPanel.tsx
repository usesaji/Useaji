"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { USE_MOCK_API } from "@/lib/api/source";
import { useNow } from "@/lib/use-now";

/**
 * While the API is mocked: a pinned "Mock data" pill (so mock data is never mistaken for real, on
 * screen or in a screenshot) that opens the demo controls — who to sign in as, skipping the mock
 * clock ahead (deadlines, grace periods, voting windows), and resetting the demo data.
 */
export function MockPanel() {
	if (!USE_MOCK_API) return null;
	return <Panel />;
}

const SKIPS = [
	{ label: "+1 hour", ms: 3_600_000 },
	{ label: "+1 day", ms: 86_400_000 },
	{ label: "+3 days", ms: 3 * 86_400_000 },
	{ label: "+1 week", ms: 7 * 86_400_000 },
];

function Panel() {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const now = useNow(1000);

	const skip = async (ms: number) => {
		const { clockOffset, setClockOffset } = await import("@/mocks/clock");
		setClockOffset(clockOffset() + ms);
		await queryClient.invalidateQueries();
		toast.info("Skipped ahead", { description: "Deadlines, grace periods and votes have moved on." });
	};

	const reset = async () => {
		const { resetMockDb } = await import("@/mocks/db");
		resetMockDb();
		queryClient.clear();
		window.location.reload();
	};

	return (
		<div className="fixed bottom-24 left-3 z-1200 lg:bottom-4">
			{open && (
				<div className="mb-2 w-64 rounded-2xl border border-line bg-white p-4 text-xs shadow-xl">
					<p className="font-medium">Demo data (no backend)</p>
					<p className="mt-1 font-light text-ink-muted">
						Sign in as <span className="font-medium text-ink">demo@usesaji.com</span> / Password1. Sign-up codes: any 4 digits but 0000.
					</p>
					<p className="mt-3 font-medium">Mock clock</p>
					<p className="font-light text-ink-muted">{now ? new Date(now).toLocaleString() : "—"}</p>
					<div className="mt-2 grid grid-cols-2 gap-1.5">
						{SKIPS.map((s) => (
							<button key={s.label} type="button" onClick={() => skip(s.ms)} className="rounded-full bg-neutral-comment px-2 py-1.5 hover:bg-primary-light">
								{s.label}
							</button>
						))}
					</div>
					<button type="button" onClick={reset} className="mt-3 w-full rounded-full bg-accent-light px-2 py-1.5 text-accent hover:bg-accent-light-hover">
						Reset demo data
					</button>
				</div>
			)}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="rounded-full bg-warning-400 px-3 py-1.5 text-xs font-semibold text-black shadow"
			>
				Mock data {open ? "×" : "⚙"}
			</button>
		</div>
	);
}
