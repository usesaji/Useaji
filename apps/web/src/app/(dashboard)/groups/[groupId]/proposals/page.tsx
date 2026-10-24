"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Pager } from "@repo/ui/pager";
import { SectionHeader } from "@/components/SectionHeader";
import { ProposalCard } from "@/features/governance/components/ProposalCard";
import { PageState, Panel, PrimaryAction } from "@/features/governance/components/ui";
import { useProposals } from "@/features/governance/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import { pageRoutes } from "@/lib/routes";

type Tab = "open" | "closed" | "all";

const TABS: { value: Tab; label: string }[] = [
	{ value: "open", label: "Active" },
	{ value: "closed", label: "Completed" },
	{ value: "all", label: "All" },
];

/** Governance / Proposals (p2): what's being voted on, and how recent votes ended. */
export default function ProposalsPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const [tab, setTab] = useState<Tab>("open");
	const [page, setPage] = useState(1);
	const list = useProposals(groupId, { status: tab === "all" ? undefined : tab, page, limit: 10 });
	const recent = useProposals(groupId, { status: "closed", limit: 3 }, tab === "open");
	const { first } = useMemberNames(groupId);
	const firstName = (m: Parameters<typeof first>[0]) => first(m);

	const proposals = list.data?.results ?? [];
	const closed = recent.data?.results ?? [];
	const empty = (text: string) => <Panel className="py-8 text-center text-sm font-light">{text}</Panel>;
	const tabs = (
		<div className="flex gap-1.5" role="tablist">
			{TABS.map(({ value, label }) => (
				<button
					key={value}
					type="button"
					role="tab"
					aria-selected={tab === value}
					onClick={() => {
						setTab(value);
						setPage(1);
					}}
					className={cn("rounded-full px-4 py-1.5 text-xs transition md:px-5 md:py-2 md:text-sm", tab === value ? "bg-primary text-white" : "bg-neutral-comment hover:bg-primary-light")}
				>
					{label}
				</button>
			))}
		</div>
	);

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Proposals" back backHref={pageRoutes.dashboardRoutes.CIRCLE(groupId)} actions={<div className="max-md:hidden">{tabs}</div>} />
			<div className="md:hidden">{tabs}</div>
			<PageState loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} />

			{list.data && (
				<div className={cn("grid items-start gap-6", tab === "open" && "md:grid-cols-2")}>
					<section className="stagger space-y-3">
						<p className="text-sm">{tab === "open" ? "Active" : tab === "closed" ? "Completed" : "All proposals"}</p>
						{proposals.length === 0
							? empty(tab === "open" ? "Nothing is being voted on right now." : "No decisions yet.")
							: proposals.map((p) => <ProposalCard key={p.id} proposal={p} groupId={groupId} firstName={firstName} tone={p.canVote ? "lilac" : "grey"} />)}
						<Pager meta={list.data.paginationMeta} onPageChange={setPage} />
					</section>

					{tab === "open" && (
						<section className="stagger space-y-3">
							<SectionHeader
								title={<span className="text-sm">Recently completed</span>}
								action={
									(recent.data?.paginationMeta.totalCount ?? 0) > 3 ? (
										<button type="button" onClick={() => setTab("closed")} className="text-xs text-primary">
											View All →
										</button>
									) : undefined
								}
							/>
							{closed.length === 0 ? empty("No decisions yet.") : closed.map((p) => <ProposalCard key={p.id} proposal={p} groupId={groupId} firstName={firstName} />)}
						</section>
					)}
				</div>
			)}

			<div className="md:flex md:justify-end">
				<PrimaryAction href={pageRoutes.dashboardRoutes.NEW_PROPOSAL(groupId)}>Create Proposal</PrimaryAction>
			</div>
		</div>
	);
}
