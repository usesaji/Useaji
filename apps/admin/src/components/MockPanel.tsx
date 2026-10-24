"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { USE_MOCK_API } from "@/lib/api/source";

/** While the API is mocked: a "Mock data" pill with the demo login, a switch to break Redis (to see Health react), and reset. */
export function MockPanel() {
	if (!USE_MOCK_API) return null;
	return <Panel />;
}

function Panel() {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();

	const toggleRedis = async () => {
		const { updateDb } = await import("@/mocks/db");
		updateDb((db) => {
			db.health.redis = db.health.redis === "up" ? "down" : "up";
		});
		await queryClient.invalidateQueries({ queryKey: ["health"] });
	};

	const reset = async () => {
		const { resetMockDb } = await import("@/mocks/db");
		resetMockDb();
		queryClient.clear();
		window.location.reload();
	};

	return (
		<div className="fixed bottom-4 left-3 z-1200">
			{open && (
				<div className="animate-drop mb-2 w-64 rounded-2xl border border-line bg-white p-4 text-xs shadow-xl">
					<p className="font-medium">Demo data (no backend)</p>
					<p className="mt-1 font-light text-ink-muted">
						Sign in as <span className="font-medium text-ink">admin@usesaji.com</span> / Password1. demo@usesaji.com is a member —
						it&apos;s refused.
					</p>
					<button
						type="button"
						onClick={toggleRedis}
						className="mt-3 w-full rounded-full bg-neutral-comment px-2 py-1.5 hover:bg-primary-light"
					>
						Toggle Redis up / down
					</button>
					<button
						type="button"
						onClick={reset}
						className="mt-2 w-full rounded-full bg-accent-light px-2 py-1.5 text-accent hover:bg-accent-light-hover"
					>
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
