"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
	HiArrowTopRightOnSquare,
	HiBanknotes,
	HiCheckBadge,
	HiCheckCircle,
	HiDocumentText,
	HiExclamationTriangle,
	HiHandThumbUp,
	HiPauseCircle,
	HiPlayCircle,
	HiXCircle,
} from "react-icons/hi2";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Pager } from "@repo/ui/pager";
import { describeEvent, type EventKind } from "@/features/governance/events";
import { PageState, Panel } from "@/features/governance/components/ui";
import { useHistory, useProposals } from "@/features/governance/hooks";
import { proposalTitle } from "@/features/governance/copy";
import { useGroup } from "@/features/groups/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import type { GroupEventDto, GroupEventKind } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

type Filter = "all" | EventKind;

const FILTERS: { value: Filter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "governance", label: "Governance" },
	{ value: "recovery", label: "Recovery" },
	{ value: "savings", label: "Savings" },
];

const STYLE: Partial<Record<GroupEventKind, { Icon: React.ComponentType<{ className?: string }>; tint: string }>> = {
	proposal_created: { Icon: HiDocumentText, tint: "bg-warning-100 text-warning-700" },
	vote_cast: { Icon: HiHandThumbUp, tint: "bg-primary-light text-primary" },
	proposal_approved: { Icon: HiCheckBadge, tint: "bg-success-50 text-success-500" },
	proposal_executed: { Icon: HiCheckCircle, tint: "bg-success-50 text-success-500" },
	proposal_rejected: { Icon: HiXCircle, tint: "bg-accent-light text-accent" },
	proposal_expired: { Icon: HiXCircle, tint: "bg-neutral-comment text-neutral-900" },
	default_recorded: { Icon: HiExclamationTriangle, tint: "bg-accent-light text-accent" },
	recovery_started: { Icon: HiExclamationTriangle, tint: "bg-accent-light text-accent" },
	default_resolved: { Icon: HiCheckCircle, tint: "bg-success-50 text-success-500" },
	recovery_resolved: { Icon: HiPlayCircle, tint: "bg-success-50 text-success-500" },
	group_paused: { Icon: HiPauseCircle, tint: "bg-warning-100 text-warning-700" },
	group_resumed: { Icon: HiPlayCircle, tint: "bg-success-50 text-success-500" },
};
const DEFAULT_STYLE = { Icon: HiBanknotes, tint: "bg-primary-light text-primary" };

/** "Today" / "Yesterday" / "Sep 28" */
function dayLabel(iso: string, today: Date) {
	const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const diff = Math.round((startOf(today) - startOf(new Date(iso))) / 86_400_000);
	if (diff === 0) return "Today";
	if (diff === 1) return "Yesterday";
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * p12 — Governance & Recovery History (`GET /groups/{id}/history`): every proposal, vote, result,
 * default and recovery step, with its Stellar transaction. The tabs are the API's `category`.
 */
export default function HistoryPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const [filter, setFilter] = useState<Filter>("all");
	const [page, setPage] = useState(1);
	const { data, isLoading, error, refetch } = useHistory(groupId, { page, limit: 40, category: filter === "all" ? undefined : filter });
	const open = useProposals(groupId, { status: "open", limit: 10 });
	const group = useGroup(groupId);
	const { name, first } = useMemberNames(groupId);

	const events = data?.results ?? [];
	const today = new Date();
	const days: { label: string; events: GroupEventDto[] }[] = [];
	for (const event of events) {
		const label = dayLabel(event.createdAt, today);
		const last = days[days.length - 1];
		if (last && last.label === label) last.events.push(event);
		else days.push({ label, events: [event] });
	}

	const tabs = (
		<div className="flex flex-wrap gap-1.5" role="tablist">
			{FILTERS.map(({ value, label }) => (
				<button
					key={value}
					type="button"
					role="tab"
					aria-selected={filter === value}
					onClick={() => {
						setFilter(value);
						setPage(1);
					}}
					className={cn("rounded-full px-4 py-1.5 text-xs transition md:px-5 md:py-2 md:text-sm", filter === value ? "bg-primary text-white" : "bg-neutral-comment hover:bg-primary-light")}
				>
					{label}
				</button>
			))}
		</div>
	);

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="History" back backHref={pageRoutes.dashboardRoutes.CIRCLE(groupId)} actions={<div className="max-md:hidden">{tabs}</div>} />
			<div className="md:hidden">{tabs}</div>
			<PageState loading={isLoading} error={error} onRetry={() => void refetch()} />

			{(open.data?.results.length ?? 0) > 0 && filter !== "savings" && (
				<section className="stagger space-y-3">
					<p className="text-sm md:text-base">Active</p>
					{open.data!.results.map((p) => (
						<Link
							key={p.id}
							href={pageRoutes.dashboardRoutes.PROPOSAL(groupId, p.id)}
							className="flex items-center justify-between gap-3 rounded-[14px] bg-primary-light px-5 py-4 transition hover:bg-primary-light-hover"
						>
							<div className="min-w-0">
								<p className="truncate text-sm md:text-base">{proposalTitle(p, (m) => first(m, { you: false }))}</p>
								<p className="text-[11px] font-light">
									{p.yes} of {p.required} approvals · Ends {new Date(p.votingEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
								</p>
							</div>
							<span className="shrink-0 rounded-full bg-primary-dark px-3 py-1 text-[11px] text-white">{p.status === "approved" ? "Approved" : "Voting"}</span>
						</Link>
					))}
				</section>
			)}

			{data &&
				(days.length === 0 ? (
					<Panel className="py-10 text-center text-sm font-light">Nothing here yet.</Panel>
				) : (
					<div className="grid items-start gap-x-8 gap-y-6 md:grid-cols-2">
						{days.map((day) => (
							<section key={day.label}>
								<p className="mb-2 text-sm md:text-base">{day.label}</p>
								<ul className="stagger divide-y divide-neutral-light">
									{day.events.map((e) => (
										<EventRow key={e.id} event={e} groupId={groupId} describe={(x) => describeEvent(x, (m) => name(m), group.data?.asset)} />
									))}
								</ul>
							</section>
						))}
					</div>
				))}
			<Pager meta={data?.paginationMeta} onPageChange={setPage} />
		</div>
	);
}

function EventRow({ event: e, groupId, describe }: { event: GroupEventDto; groupId: string; describe: (e: GroupEventDto) => { title: string; body: string } }) {
	const { Icon, tint } = STYLE[e.kind] ?? DEFAULT_STYLE;
	const { title, body } = describe(e);
	const proposalId = typeof (e.data as { proposalId?: unknown }).proposalId === "string" ? (e.data as { proposalId: string }).proposalId : null;
	const time = new Date(e.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
	const content = (
		<>
			<span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg", tint)}>
				<Icon />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-baseline justify-between gap-3">
					<span className="text-sm">{title}</span>
					<span className="shrink-0 text-[11px] font-light">{time}</span>
				</span>
				<span className="block text-[11px] font-light">{body}</span>
				{e.txUrl && (
					<span className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
						{e.anchorHash ? "Anchored on Stellar Testnet" : "Stellar Testnet"} <HiArrowTopRightOnSquare />
					</span>
				)}
			</span>
		</>
	);
	return (
		<li>
			{proposalId ? (
				<Link href={pageRoutes.dashboardRoutes.PROPOSAL(groupId, proposalId)} className="flex gap-3 py-3 transition hover:opacity-80">
					{content}
				</Link>
			) : e.txUrl ? (
				<a href={e.txUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 py-3 transition hover:opacity-80">
					{content}
				</a>
			) : (
				<div className="flex gap-3 py-3">{content}</div>
			)}
		</li>
	);
}
