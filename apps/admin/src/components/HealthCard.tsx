"use client";

import { StatusPill } from "@repo/ui/panel";
import { cn } from "@repo/ui/lib/utils";
import type { HealthView } from "@/lib/api/dto";

/** One dependency's row: a dot that pulses while it's up, or holds pink when it's down. */
export function DependencyRow({ name, status, message }: { name: string; status: "up" | "down"; message?: string }) {
	const up = status === "up";
	return (
		<li className="flex items-center justify-between gap-3 border-b border-neutral-light py-3 last:border-0">
			<span className="flex items-center gap-3 text-sm capitalize">
				<span className="relative flex size-2.5">
					{up && <span className="animate-ping-soft absolute inset-0 rounded-full bg-success-500" />}
					<span className={cn("relative size-2.5 rounded-full", up ? "bg-success-500" : "bg-accent")} />
				</span>
				{name}
			</span>
			<span className="flex items-center gap-2">
				{message && <span className="hidden text-xs font-light text-ink-muted sm:inline">{message}</span>}
				<StatusPill tone={up ? "green" : "pink"}>{up ? "Up" : "Down"}</StatusPill>
			</span>
		</li>
	);
}

export function DependencyList({ details }: { details: HealthView["details"] }) {
	return (
		<ul>
			{Object.entries(details).map(([name, d]) => (
				<DependencyRow key={name} name={name} status={d.status} />
			))}
		</ul>
	);
}
