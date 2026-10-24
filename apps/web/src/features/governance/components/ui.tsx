"use client";

import Link from "next/link";
import { HiArrowTopRightOnSquare, HiCheck } from "react-icons/hi2";
import { cn } from "@repo/ui/lib/utils";
import { Panel, StatusPill } from "@repo/ui/panel";
import type { ProposalDto } from "@/lib/api/dto";
import { explorerTxUrl } from "@/lib/stellar/config";

/**
 * Building blocks shared by the governance and recovery screens, so the twelve screens of the MVP 2
 * designs stay one visual family.
 */

/** "18h left" / "2d left" / "Closing" / "Closed", from `now` (useNow). */
export function timeLeft(iso: string, now: number) {
	const ms = new Date(iso).getTime() - now;
	if (!now) return "";
	if (ms <= 0) return "Closed";
	const hours = Math.floor(ms / 3_600_000);
	if (hours < 1) return "Closing";
	if (hours < 48) return `${hours}h left`;
	return `${Math.floor(hours / 24)}d left`;
}

/** "7f45…c81a" */
export const shortHash = (hash: string) => `${hash.slice(0, 4)}…${hash.slice(-4)}`;

export { Panel, StatusPill };

export type InfoRow = {
	Icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: React.ReactNode;
	/** Colours the value: green for done/none, pink for money owed or held. */
	tone?: "green" | "pink";
};

/** Icon · label · value rows — the "Decision / Effective / Executed" lists. */
export function InfoList({ rows }: { rows: InfoRow[] }) {
	return (
		<Panel className="space-y-3">
			{rows.map(({ Icon, label, value, tone }) => (
				<div key={label} className="flex items-center justify-between gap-4 text-xs md:text-sm">
					<span className="flex items-center gap-2 font-light">
						<Icon className="shrink-0 text-base text-primary" />
						{label}
					</span>
					<span className={cn("text-right", tone === "green" && "text-success-500", tone === "pink" && "text-accent")}>{value}</span>
				</div>
			))}
		</Panel>
	);
}

/**
 * Vote progress: the approval bar against the threshold and how many have voted. `mode` picks the
 * right-hand figure: "split" → "3 For · 1 Against"; "needed" → "3 of 4 needed".
 */
export function VoteProgress({ proposal: p, title, mode = "split", heading }: { proposal: ProposalDto; title?: string; mode?: "split" | "needed"; heading?: string }) {
	const percent = Math.min(100, Math.round((p.yes / Math.max(p.required, 1)) * 100));
	const voted = p.yes + p.no;
	return (
		<Panel>
			{heading && <p className="mb-3 text-sm md:text-base">{heading}</p>}
			<div className="flex items-center justify-between gap-3 text-xs">
				<span className="font-light">{title ?? "Approval progress"}</span>
				<span>{mode === "needed" ? `${p.yes} of ${p.required} needed` : `${p.yes} For · ${p.no} Against`}</span>
			</div>
			<div className="mt-2 h-1.5 rounded-full bg-primary-light" role="progressbar" aria-valuenow={p.yes} aria-valuemin={0} aria-valuemax={p.required}>
				<div className="animate-grow h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
			</div>
			<div className="mt-4 flex items-center justify-between gap-3 text-xs">
				<span className="font-light">
					{p.required} {p.required === 1 ? "vote" : "votes"} to pass
				</span>
				<span>
					{voted} of {p.eligible} members voted
				</span>
			</div>
		</Panel>
	);
}

/** "Stellar Testnet transaction · <hash> · <state>" with an explorer link. */
export function TxCard({ hash, state }: { hash: string | null | undefined; state: string }) {
	return (
		<Panel className="flex items-center justify-between gap-3">
			<div className="min-w-0">
				<p className="text-[11px] font-light">Stellar Testnet transaction</p>
				<p className="mt-0.5 truncate text-xs md:text-sm">
					{hash ? `${shortHash(hash)} · ` : ""}
					{state}
				</p>
			</div>
			{hash && (
				<a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" aria-label="View on Stellar explorer" className="shrink-0 text-lg text-primary">
					<HiArrowTopRightOnSquare />
				</a>
			)}
		</Panel>
	);
}

const HERO: Record<"lilac" | "pink" | "green" | "yellow", { box: string; badge: string; title: string }> = {
	lilac: { box: "bg-primary-light", badge: "bg-primary text-white", title: "text-neutral-dark" },
	pink: { box: "bg-accent-light", badge: "bg-accent text-white", title: "text-neutral-dark" },
	green: { box: "bg-success-50", badge: "bg-success-400 text-white", title: "text-success-700" },
	yellow: { box: "bg-warning-50", badge: "bg-warning-400 text-neutral-dark", title: "text-neutral-dark" },
};

/** The big outcome banner: result, missed contribution, recovery complete. */
export function Hero({ tone, Icon = HiCheck, title, children }: { tone: keyof typeof HERO; Icon?: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
	const t = HERO[tone];
	return (
		<section className={cn("flex flex-col items-center rounded-[14px] px-6 py-8 text-center md:py-10", t.box)}>
			<span className={cn("animate-pop flex h-14 w-14 items-center justify-center rounded-full text-2xl md:h-16 md:w-16 md:text-3xl", t.badge)}>
				<Icon />
			</span>
			<h2 className={cn("mt-4 text-lg md:text-xl", t.title)}>{title}</h2>
			<div className="mt-1 max-w-md text-xs font-light md:text-sm">{children}</div>
		</section>
	);
}

/** Lilac or yellow explanatory card. */
export function Note({ tone = "lilac", Icon, title, children }: { tone?: "lilac" | "yellow"; Icon?: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode }) {
	return (
		<section className={cn("flex items-start gap-3 rounded-[14px] px-4 py-4 md:px-5", tone === "yellow" ? "bg-warning-50" : "bg-primary-light")}>
			{Icon && (
				<span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg", tone === "yellow" ? "bg-warning-400 text-neutral-dark" : "bg-white text-primary")}>
					<Icon />
				</span>
			)}
			<div className="min-w-0">
				<p className={cn("text-sm md:text-base", tone === "lilac" && "text-primary")}>{title}</p>
				{children && <div className="mt-1 text-xs font-light">{children}</div>}
			</div>
		</section>
	);
}

/** Selectable option with an icon and a check — vote choices, actions, recovery options. */
export function OptionCard({
	selected,
	onSelect,
	Icon,
	title,
	subtitle,
	disabled = false,
}: {
	selected: boolean;
	onSelect: () => void;
	Icon: React.ComponentType<{ className?: string }>;
	title: string;
	subtitle: string;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			disabled={disabled}
			onClick={onSelect}
			className={cn(
				"flex w-full items-center gap-3 rounded-[14px] px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 md:px-5",
				selected ? "bg-primary-light" : "bg-panel hover:bg-[#f2f2f2]",
			)}
		>
			<span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg", selected ? "bg-primary text-white" : "bg-white text-neutral-900")}>
				<Icon />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm">{title}</span>
				<span className="block text-[11px] font-light">{subtitle}</span>
			</span>
			<span aria-hidden className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary text-white" : "bg-primary-light")}>
				{selected && <HiCheck className="text-sm" />}
			</span>
		</button>
	);
}

const ACTION_CLASS =
	"inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-light-hover disabled:text-neutral-light-active max-md:w-full md:h-11";

/** The screen's main action: full width on phones, a compact pill on desktop. */
export function PrimaryAction(props: ({ href: string; children: React.ReactNode }) | (React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })) {
	if (props.href) {
		return (
			<Link href={props.href} className={ACTION_CLASS}>
				{props.children}
			</Link>
		);
	}
	const { className, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
	return <button type="button" className={cn(ACTION_CLASS, className)} {...rest} />;
}

/** Loading and error states shared by these pages. */
export function PageState({ loading, error, onRetry }: { loading: boolean; error: unknown; onRetry: () => void }) {
	if (loading) {
		return (
			<div className="grid gap-4 md:grid-cols-2">
				<div className="h-48 animate-pulse rounded-[14px] bg-panel" />
				<div className="h-48 animate-pulse rounded-[14px] bg-panel" />
			</div>
		);
	}
	if (error) {
		return (
			<Panel className="text-sm">
				<p className="text-error-500">{error instanceof Error ? error.message : "Something went wrong."}</p>
				<button type="button" onClick={onRetry} className="mt-2 font-medium underline">
					Try again
				</button>
			</Panel>
		);
	}
	return null;
}
