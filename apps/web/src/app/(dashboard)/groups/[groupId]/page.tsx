"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { GoBack } from "@/components/GoBack";
import { LinkButton } from "@/components/LinkButton";
import { QueryState } from "@repo/ui/query-state";
import { useAccount } from "@/features/auth/hooks";
import { useStartGroup } from "@/features/circle/hooks";
import { useGovernance } from "@/features/governance/hooks";
import { GroupPreview } from "@/features/groups/components/GroupPreview";
import { InviteLink } from "@/features/groups/components/InviteLink";
import { MembersList } from "@/features/groups/components/MembersList";
import { JoinRequestAlert, PendingRequests } from "@/features/groups/components/PendingRequests";
import { useGroup, useJoin, useJoinRequests, useLeaveGroup, useMembers, useRemoveMember, useUploadCover } from "@/features/groups/hooks";
import { pageRoutes } from "@/lib/routes";

/**
 * A forming group: its settings and members; for the admin, the invite link, join requests, editing
 * the settings, removing members, the approval rules and Start. Members may leave while it forms. Once the cycle has started this page hands over to the circle view
 * (`?manage=1` keeps it, for the member list).
 */
export default function GroupPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const router = useRouter();
	const manage = useSearchParams().get("manage") === "1";
	const { data: group, isLoading, error, refetch } = useGroup(groupId);
	const { data: account } = useAccount();
	const isMember = !!group?.myRole;
	const isAdmin = group?.myRole === "admin";
	const members = useMembers(groupId, isMember);
	const requests = useJoinRequests(groupId, isAdmin && group?.status === "forming");
	const rules = useGovernance(groupId, isMember);
	const start = useStartGroup(groupId);
	const upload = useUploadCover(groupId);
	const join = useJoin();
	const remove = useRemoveMember(groupId);

	const started = !!group && group.status !== "forming";
	useEffect(() => {
		if (started && isMember && !manage) router.replace(pageRoutes.dashboardRoutes.CIRCLE(groupId));
	}, [started, isMember, manage, groupId, router]);

	if (isLoading || error || !group) {
		return (
			<div className="w-full max-w-4xl pb-10">
				<GoBack href={pageRoutes.dashboardRoutes.GROUPS} />
				<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} className="mt-6" />
			</div>
		);
	}
	if (started && isMember && !manage) return <p className="mt-6 text-center text-sm text-ink-muted">Taking you to your circle…</p>;

	const memberCount = members.data?.length ?? group.memberCount;
	const pending = requests.data ?? [];
	const ordered = group.payoutOrder === "manual" || group.payoutOrder === "custom";
	const canStart = memberCount >= 2;

	return (
		<div className="w-full max-w-4xl pb-10">
			<GoBack href={pageRoutes.dashboardRoutes.GROUPS} />

			<GroupPreview group={group} rules={rules.data} onBannerUpload={isAdmin && group.status === "forming" ? (file) => upload.mutateAsync(file) : undefined}>
				{!isMember &&
					(group.requestPending || join.data?.status === "requested" ? (
						<p className="rounded-xl bg-warning-100 px-4 py-3 text-sm text-warning-800">Your request to join is waiting for the admin&apos;s approval.</p>
					) : (
						<Button variant="secondary" isLoading={join.isPending} onClick={() => join.mutate({ groupId }, { onSuccess: () => void refetch() })}>
							Join Group
						</Button>
					))}
			</GroupPreview>

			{isAdmin && group.invite && group.status === "forming" && <InviteLink groupId={groupId} invite={group.invite} />}

			{isAdmin && group.status === "forming" && (
				<section className="mt-8 space-y-6 rounded-2xl bg-[#f7f7f7] p-4 md:p-6">
					<div>
						<h3 className="md:text-xl">Admin setup</h3>
						<p className="mt-1 text-xs font-light text-ink-muted">Complete these steps to get your group running.</p>
						<ol className="mt-4 space-y-2">
							<ChecklistItem done={pending.length === 0} label={pending.length === 0 ? "All join requests reviewed" : `${pending.length} join request${pending.length === 1 ? "" : "s"} awaiting approval`} />
							<ChecklistItem done={canStart} label={`${memberCount} member${memberCount === 1 ? "" : "s"}${canStart ? "" : " (need at least 2)"}`} />
							<ChecklistItem done={false} muted label={<Link href={pageRoutes.dashboardRoutes.GROUP_RULES(groupId)} className="underline">Review the approval rules — they lock when you start</Link>} />
							<ChecklistItem done={false} label={ordered ? "Set the payout order and start the cycle" : "Start the cycle"} />
						</ol>
					</div>

					<PendingRequests groupId={groupId} requests={pending} limit={2} showViewAll />

					<div>
						<p className="text-sm font-medium">Members</p>
						<MembersList
							members={members.data ?? []}
							meId={account?.id}
							onRemove={(m, name) => remove.mutate({ userId: m.userId, name })}
							removingId={remove.isPending ? remove.variables?.userId : null}
						/>
					</div>

					<div className="flex flex-col gap-3 md:flex-row">
						{ordered ? (
							<LinkButton href={pageRoutes.dashboardRoutes.PAYOUT_ORDER(groupId)} className="w-full md:w-auto" aria-disabled={!canStart}>
								Set Payout Order &amp; Start
							</LinkButton>
						) : (
							<Button onClick={() => start.mutate(undefined)} isLoading={start.isPending} disabled={!canStart} className="w-full md:w-auto">
								Start Cycle
							</Button>
						)}
						<LinkButton href={pageRoutes.dashboardRoutes.GROUP_RULES(groupId)} variant="outline" className="w-full md:w-auto">
							Approval Rules
						</LinkButton>
						<LinkButton href={pageRoutes.dashboardRoutes.GROUP_EDIT(groupId)} variant="outline" className="w-full md:w-auto">
							Edit Settings
						</LinkButton>
					</div>
					{!canStart && <p className="text-xs font-light text-ink-muted">You need at least 2 members to start. Approve requests or share your invite link.</p>}
					{canStart && (
						<p className="text-xs font-light text-ink-muted">
							{group.payoutOrder === "random"
								? "Starting shuffles the payout order, opens round 1 and closes the group to new members."
								: group.payoutOrder === "vote"
									? "Starting uses join order (members can change it by proposal), opens round 1 and closes the group to new members."
									: "Choose who collects first, then start: round 1 opens and the group closes to new members."}
						</p>
					)}
				</section>
			)}

			{isMember && !isAdmin && group.status === "forming" && (
				<p className="mt-6 rounded-xl bg-[#f7f7f7] px-4 py-3 text-sm text-ink-muted">You&apos;re in. The admin will start the cycle once everyone has joined — we&apos;ll let you know.</p>
			)}

			{isMember && started && (
				<section className="mt-8 rounded-2xl bg-[#f7f7f7] p-4 md:p-6">
					<p className="text-sm font-medium">Members</p>
					<MembersList members={members.data ?? []} meId={account?.id} />
				</section>
			)}

			{isMember && group.status === "forming" && memberCount > 1 && <LeaveGroup groupId={groupId} isAdmin={isAdmin} />}

			{isAdmin && group.status === "forming" && <JoinRequestAlert groupId={groupId} groupName={group.name} requests={pending} />}
		</div>
	);
}

function ChecklistItem({ done, label, muted }: { done: boolean; label: React.ReactNode; muted?: boolean }) {
	return (
		<li className="flex items-center gap-2 text-sm">
			<span
				className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
					done ? "bg-success-50 text-success-700" : "bg-white text-ink-muted ring-1 ring-neutral-light-hover"
				}`}
			>
				{done ? "✓" : ""}
			</span>
			<span className={done ? "text-neutral-dark" : muted ? "text-ink-muted" : "font-medium"}>{label}</span>
		</li>
	);
}

/** Leaving is only possible while the group forms; it asks once more before it acts. */
function LeaveGroup({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
	const leave = useLeaveGroup(groupId);
	const [confirming, setConfirming] = useState(false);
	return (
		<div className="mt-8 border-t border-neutral-light pt-6 text-center md:text-left">
			{confirming ? (
				<div className="animate-fade space-y-3">
					<p className="text-sm">
						Leave this group?{isAdmin ? " If you're the last admin, the longest-standing member becomes admin." : ""}
					</p>
					<div className="flex justify-center gap-2 md:justify-start">
						<Button variant="destructive" size="sm" isLoading={leave.isPending} onClick={() => leave.mutate()}>
							Leave group
						</Button>
						<Button variant="soft" size="sm" onClick={() => setConfirming(false)} disabled={leave.isPending}>
							Stay
						</Button>
					</div>
				</div>
			) : (
				<button type="button" onClick={() => setConfirming(true)} className="text-sm text-accent underline-offset-4 hover:underline">
					Leave this group
				</button>
			)}
		</div>
	);
}
