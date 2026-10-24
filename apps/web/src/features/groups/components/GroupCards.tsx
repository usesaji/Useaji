"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { TbMoneybag } from "react-icons/tb";
import { cn } from "@repo/ui/lib/utils";
import { LinkButton } from "@/components/LinkButton";
import { MemberAvatars } from "@/components/MemberAvatars";
import { coverOf, groupBadge, groupHref, summaryProgress } from "@/features/groups/view";
import type { GroupSummaryDto } from "@/lib/api/dto";
import { formatMoney, frequencyLabel, shortDate } from "@/lib/format";
import { useNow } from "@/lib/use-now";

/**
 * A group in a list: `GroupCard` (desktop grid) and `GroupRow` (compact mobile list). Badge,
 * progress, faces and next deadline all come from the viewer's state on `GroupSummaryDto`.
 */

/** Mobile progress bars cycle through the brand colours, as in the design. */
const BAR_COLORS = ["bg-primary", "bg-accent", "bg-warning-500"];

function ProgressBar({ percent, color }: { percent: number; color: string }) {
	return (
		<div className="h-1.5 rounded-full bg-neutral-light" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
			<div className={cn("animate-grow h-full rounded-full transition-all", color)} style={{ width: `${percent}%` }} />
		</div>
	);
}

function useCard(group: GroupSummaryDto) {
	const now = useNow();
	return { badge: groupBadge(group, now), progress: summaryProgress(group), faces: group.membersPreview.slice(0, 3) };
}

export function GroupRow({ group, index = 0 }: { group: GroupSummaryDto; index?: number }) {
	const { progress, faces } = useCard(group);
	return (
		<Link href={groupHref(group)} className="block space-y-3 rounded-xl bg-panel p-4 transition hover:bg-[#f2f2f2]">
			<div className="flex items-center justify-between gap-3">
				<p className="truncate text-sm">{group.name}</p>
				<div className="flex shrink-0 items-center gap-1.5">
					<MemberAvatars members={faces} total={group.memberCount} size="sm" overflowClassName="bg-primary text-white" />
					<span className="text-[11px]">
						{group.memberCount} {group.memberCount === 1 ? "Member" : "Members"}
					</span>
				</div>
			</div>
			<ProgressBar percent={progress.percent} color={BAR_COLORS[index % BAR_COLORS.length]!} />
			<div className="flex items-center justify-between gap-3 text-[11px]">
				<span className="flex items-center gap-1.5">
					<TbMoneybag className="text-sm text-primary" />
					{group.status === "forming" ? "Not started" : group.status === "completed" ? "Completed" : `Next Deposit : ${shortDate(group.deadline)}`}
				</span>
				<span>{progress.total > 0 ? `Round ${Math.min(progress.done + 1, progress.total)} / ${progress.total}` : formatMoney(group.contributionAmount, group.asset)}</span>
			</div>
		</Link>
	);
}

export function GroupCard({ group }: { group: GroupSummaryDto }) {
	const { badge, progress, faces } = useCard(group);
	return (
		<article className="flex flex-col rounded-[20px] bg-panel p-6 lg:p-7">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-4">
					<img src={coverOf(group)} alt="" className="h-14 w-14 shrink-0 rounded-full bg-primary-light object-cover" />
					<div className="min-w-0">
						<p className="text-[10px] tracking-[0.15em] uppercase">Contribution</p>
						<p className="truncate text-base">
							{formatMoney(group.contributionAmount)} <span className="text-xs text-neutral-900">{group.asset}</span>
						</p>
					</div>
				</div>
				<span className={cn("shrink-0 rounded-full px-3 py-1 text-[10px] font-medium", badge.tone)}>{badge.label}</span>
			</div>

			<div className="mt-9">
				<p className="truncate text-xl">{group.name}</p>
				<p className="text-[11px]">{frequencyLabel(group.frequency)} Contributions · Target {formatMoney(group.targetAmount, group.asset)}</p>
			</div>

			<div className="mt-5 space-y-1.5">
				<ProgressBar percent={progress.percent} color="bg-primary" />
				<p className="text-[11px] font-light">
					{group.status === "forming" ? "The cycle hasn't started yet" : progress.total > 0 ? `${progress.done} of ${progress.total} rounds paid out` : "…"}
				</p>
			</div>

			<div className="mt-auto flex items-end justify-between gap-4 pt-10">
				<div className="min-w-0">
					<p className="text-[10px] tracking-[0.15em] uppercase">Members</p>
					<div className="mt-2 flex items-center gap-2">
						<MemberAvatars members={faces} total={group.memberCount} overflowClassName="bg-primary text-white" />
						<span className="text-sm whitespace-nowrap">
							{group.memberCount} {group.memberCount === 1 ? "Member" : "Members"}
						</span>
					</div>
				</div>
				<LinkButton href={groupHref(group)} variant="dark" size="sm" className="w-1/2 max-w-60 text-sm lg:text-sm">
					View Details
				</LinkButton>
			</div>
		</article>
	);
}
