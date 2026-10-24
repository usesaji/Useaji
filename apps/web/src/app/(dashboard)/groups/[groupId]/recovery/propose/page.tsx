"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { HiBanknotes, HiCalendarDays, HiClock, HiOutlineUserGroup, HiRectangleStack, HiUserMinus, HiXCircle } from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { useCycle } from "@/features/circle/hooks";
import { RECOVERY_ACTIONS } from "@/features/governance/copy";
import { InfoList, Note, OptionCard, PageState, Panel, PrimaryAction, StatusPill } from "@/features/governance/components/ui";
import { useCreateProposal, useGovernance } from "@/features/governance/hooks";
import { useGroup } from "@/features/groups/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import type { RecoveryAction } from "@/lib/api/dto";
import { formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { currentTime, useNow } from "@/lib/use-now";

const ICONS: Record<RecoveryAction, React.ComponentType<{ className?: string }>> = {
	grace_extension: HiCalendarDays,
	write_off: HiXCircle,
	remove_member: HiUserMinus,
};

/** "YYYY-MM-DD" for a date input, `days` after `now`. */
const dateInput = (now: number, days: number) => (now ? new Date(now + days * 86_400_000).toISOString().slice(0, 10) : "");

/** p9 — Recovery Proposal draft: the chosen action (and new deadline) plus a rationale. */
export default function RecoveryProposePage() {
	return (
		<Suspense>
			<Propose />
		</Suspense>
	);
}

function Propose() {
	const { groupId } = useParams<{ groupId: string }>();
	const search = useSearchParams();
	const router = useRouter();
	const cycle = useCycle(groupId);
	const group = useGroup(groupId);
	const rules = useGovernance(groupId);
	const { first } = useMemberNames(groupId);
	const create = useCreateProposal(groupId);
	const now = useNow(60_000);
	const [rationale, setRationale] = useState("");
	const [picked, setGraceDate] = useState<string | null>(null);
	const graceDate = picked ?? dateInput(now, 3);

	const d = cycle.data?.openDefaults.find((x) => x.id === search.get("default"));
	const action = search.get("action") as RecoveryAction | null;
	const valid = !!d && !!action && d.availableActions.includes(action);
	const who = d ? first(d.member, { you: false }) : "";
	// End of the chosen day, local time.
	const graceUntil = graceDate ? new Date(`${graceDate}T23:59:00`).toISOString() : "";
	const graceOk = action !== "grace_extension" || (!!graceUntil && new Date(graceUntil).getTime() > currentTime());

	const submit = () => {
		if (!d || !action) return;
		create.mutate(
			{ type: "recovery", defaultId: d.id, recoveryAction: action, description: rationale.trim(), ...(action === "grace_extension" ? { graceUntil } : {}) },
			{ onSuccess: (p) => router.push(pageRoutes.dashboardRoutes.PROPOSAL(groupId, p.id)) },
		);
	};

	const button = (
		<PrimaryAction onClick={submit} disabled={create.isPending || !valid || rationale.trim().length < 3 || !graceOk}>
			{create.isPending ? "Submitting…" : "Submit for a Vote"}
		</PrimaryAction>
	);

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Recovery Proposal" back backHref={pageRoutes.dashboardRoutes.RECOVERY_OPTIONS(groupId, d?.id)} />
			<PageState loading={cycle.isLoading} error={cycle.error} onRetry={() => void cycle.refetch()} />
			{cycle.data && !valid && <Panel className="py-10 text-center text-sm">This recovery option isn&apos;t available any more. Go back to see what is.</Panel>}

			{d && action && valid && (
				<>
					<div className="grid items-start gap-6 md:grid-cols-2">
						<div className="space-y-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-[11px] tracking-wide text-primary uppercase">
										{group.data?.name ?? "Group"} · Round {d.round + 1}
									</p>
									<h3 className="mt-1 text-xl md:text-2xl">Resolve missed contribution</h3>
								</div>
								<StatusPill tone="gray">Draft</StatusPill>
							</div>
							<div>
								<p className="mb-2 text-sm">Proposed recovery action</p>
								<OptionCard
									selected
									onSelect={() => router.push(pageRoutes.dashboardRoutes.RECOVERY_OPTIONS(groupId, d.id))}
									Icon={ICONS[action]}
									title={RECOVERY_ACTIONS[action].label(who)}
									subtitle={RECOVERY_ACTIONS[action].subtitle(who)}
								/>
							</div>
							{action === "grace_extension" && (
								<label className="block space-y-2">
									<span className="text-sm">New deadline for {who}</span>
									<input
										type="date"
										value={graceDate}
										min={dateInput(now, 1)}
										onChange={(e) => setGraceDate(e.target.value)}
										className="h-12 w-full rounded-full border border-neutral-light-hover bg-white px-5 text-sm outline-none focus:border-primary"
									/>
									{!graceOk && <span className="block text-xs text-error-400">Choose a date in the future.</span>}
								</label>
							)}
							<label className="block space-y-2">
								<span className="text-sm">Rationale</span>
								<textarea
									value={rationale}
									onChange={(e) => setRationale(e.target.value)}
									rows={4}
									maxLength={1000}
									placeholder={`e.g. ${who} told the group about a delayed salary payment. A short extension keeps the payout plan intact.`}
									className="w-full resize-none rounded-[14px] border border-neutral-light-hover bg-white px-4 py-3 text-sm outline-none focus:border-primary"
								/>
							</label>
						</div>
						<div className="space-y-4">
							<Note title="Before you submit">Members review the exact action and rationale. Payouts stay on hold while voting is open.</Note>
							<InfoList
								rows={[
									{ Icon: HiRectangleStack, label: "Affected round", value: `Round ${d.round + 1}` },
									{ Icon: HiBanknotes, label: "Affected amount", value: formatMoney(d.amount, group.data?.asset ?? "USDC") },
									{
										Icon: HiOutlineUserGroup,
										label: "Approval threshold",
										value: rules.data ? (rules.data.thresholdKind === "percent" ? `${rules.data.thresholdValue}% of eligible members` : `${rules.data.thresholdValue} members`) : "—",
									},
									{ Icon: HiClock, label: "Voting period", value: rules.data ? `${rules.data.votingPeriodHours} hours` : "—" },
								]}
							/>
							<div className="max-md:hidden md:flex md:justify-end">{button}</div>
						</div>
					</div>
					<div className="md:hidden">{button}</div>
				</>
			)}
		</div>
	);
}
