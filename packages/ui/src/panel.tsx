import { cn } from "./lib/utils";

/** Saji's pill tones: lilac (primary), green (done), pink (owed, missed, failed), yellow (waiting), gray. */
export type Tone = "lilac" | "green" | "pink" | "yellow" | "gray";

const PILL: Record<Tone, string> = {
	lilac: "bg-primary-light text-primary",
	green: "bg-success-50 text-success-700",
	pink: "bg-accent-light text-accent",
	yellow: "bg-warning-100 text-warning-800",
	gray: "bg-neutral-comment text-neutral-900",
};

/** A small rounded status label. */
export function StatusPill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
	return <span className={cn("inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px]", PILL[tone], className)}>{children}</span>;
}

/** The grey rounded card most sections sit in. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
	return <div className={cn("rounded-[14px] bg-panel p-4 md:p-5", className)}>{children}</div>;
}
