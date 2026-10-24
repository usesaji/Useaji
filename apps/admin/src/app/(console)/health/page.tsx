"use client";

import { HiArrowPath } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { Panel } from "@repo/ui/panel";
import { QueryState } from "@repo/ui/query-state";
import { cn } from "@repo/ui/lib/utils";
import { PageTitle } from "@/components/Console";
import { DependencyList } from "@/components/HealthCard";
import { useHealth } from "@/features/admin/hooks";

/** `GET /health`: the database and Redis, re-checked every 30 s. */
export default function HealthPage() {
	const health = useHealth();
	const h = health.data;
	const ok = h?.status === "ok";

	return (
		<div className="space-y-6">
			<PageTitle
				title="Health"
				subtitle="The API's own check of its database and Redis, every 30 seconds."
				actions={
					<Button variant="outline" size="sm" onClick={() => health.refetch()} isLoading={health.isFetching}>
						<HiArrowPath /> Check now
					</Button>
				}
			/>
			<QueryState isLoading={health.isLoading} error={health.error} onRetry={() => health.refetch()} skeletonClassName="h-56" />
			{h && (
				<>
					<div
						key={`${h.status}-${h.checkedAt}`}
						className={cn(
							"animate-pop flex items-center gap-4 rounded-[20px] px-6 py-6 text-white",
							ok ? "bg-success-600" : "bg-accent",
						)}
					>
						<span className="relative flex size-4">
							<span className="animate-ping-soft absolute inset-0 rounded-full bg-white/70" />
							<span className="relative size-4 rounded-full bg-white" />
						</span>
						<div>
							<p className="text-xl md:text-2xl">{ok ? "All systems working" : "Something is down"}</p>
							<p className="text-xs font-light opacity-90">
								Checked {new Date(h.checkedAt).toLocaleTimeString()} · answered in {h.latencyMs} ms
								{h.message ? ` · ${h.message}` : ""}
							</p>
						</div>
					</div>
					<Panel className="animate-rise md:p-6">
						<h2 className="text-lg">Dependencies</h2>
						<DependencyList details={h.details} />
					</Panel>
				</>
			)}
			<p className="text-xs font-light text-ink-muted">
				Live, <span className="font-mono">/health</span> is public and sits outside <span className="font-mono">/v1</span>. Chain
				sync and the default scanner aren&apos;t reported yet (BACKEND-GAPS.md, C).
			</p>
		</div>
	);
}
