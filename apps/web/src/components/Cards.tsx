"use client";

import { cn } from "@repo/ui/lib/utils";

/**
 * The v3 screens' building blocks (personal savings, slot marketplace): grey cards of plain lines,
 * lilac cards for what to know before acting, a thin progress bar. Two columns on desktop
 * (main · summary), one on mobile.
 */

/** Main column + summary column, as every v3 screen lays out. */
export function TwoColumns({ main, side }: { main: React.ReactNode; side: React.ReactNode }) {
	return (
		<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div className="min-w-0 space-y-5">{main}</div>
			<div className="min-w-0 space-y-5">{side}</div>
		</div>
	);
}

/** A grey card: title, then plain lines. `tone="lilac"` for notes, rules and confirmations. */
export function Card({
	title,
	tone = "grey",
	className,
	children,
}: {
	title?: React.ReactNode;
	tone?: "grey" | "lilac";
	className?: string;
	children?: React.ReactNode;
}) {
	const lilac = tone === "lilac";
	return (
		<section className={cn("rounded-[20px] p-5", lilac ? "bg-primary-light" : "bg-panel", className)}>
			{title && <h3 className={cn("text-base md:text-lg", lilac && "text-primary-darker")}>{title}</h3>}
			{children && (
				<div
					className={cn(
						"space-y-3 text-xs font-light md:text-sm",
						title && "mt-3",
						lilac ? "text-primary-dark" : "text-ink-muted",
					)}
				>
					{children}
				</div>
			)}
		</section>
	);
}

/** A thin progress track (percent of a goal). */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
	const value = Math.max(0, Math.min(100, percent));
	return (
		<div
			className="h-1.5 rounded-full bg-neutral-light"
			role="progressbar"
			aria-label={label}
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<div className="animate-grow h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
		</div>
	);
}
