"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HiBanknotes, HiCalendarDays, HiExclamationTriangle, HiOutlineUser, HiPauseCircle, HiRectangleStack, HiUserMinus, HiXCircle } from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { useCycle } from "@/features/circle/hooks";
import { RECOVERY_ACTIONS } from "@/features/governance/copy";
import { InfoList, Note, OptionCard, PageState, Panel, PrimaryAction } from "@/features/governance/components/ui";
import { useGovernance } from "@/features/governance/hooks";
import { useGroup } from "@/features/groups/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import type { RecoveryAction } from "@/lib/api/dto";
import { formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

const ICONS: Record<RecoveryAction, React.ComponentType<{ className?: string }>> = {
	grace_extension: HiCalendarDays,
	write_off: HiXCircle,
	remove_member: HiUserMinus,
};

/** p7 — Recovery Required: the actions the group may vote on for this missed contribution (`availableActions`). */
export default function RecoveryOptionsPage() {
	return (
		<Suspense>
			<Options />
		</Suspense>
	);
}

function Options() {
	const { groupId } = useParams<{ groupId: string }>();
	const defaultId = useSearchParams().get("default");
	const cycle = useCycle(groupId);
	const group = useGroup(groupId);
	const rules = useGovernance(groupId);
	const { name, first } = useMemberNames(groupId);
	const d = cycle.data?.openDefaults.find((x) => x.id === defaultId) ?? cycle.data?.openDefaults[0];
	const [picked, setPicked] = useState<RecoveryAction | null>(null);
	const action = picked && d?.availableActions.includes(picked) ? picked : (d?.availableActions[0] ?? null);
	const who = d ? first(d.member, { you: false }) : "";
	const asset = group.data?.asset ?? "USDC";

	const next = d && action && <PrimaryAction href={pageRoutes.dashboardRoutes.RECOVERY_PROPOSE(groupId, d.id, action)}>Create Recovery Proposal</PrimaryAction>;

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Recovery Required" back backHref={pageRoutes.dashboardRoutes.RECOVERY(groupId)} />
			<PageState loading={cycle.isLoading} error={cycle.error} onRetry={() => void cycle.refetch()} />
			{cycle.data && !d && <Panel className="py-10 text-center text-sm">Nothing needs recovering right now.</Panel>}
			{d && d.availableActions.length === 0 && (
				<Panel className="py-10 text-center text-sm">{d.graceUntil ? `${who} has been given more time to pay. The options return if the new deadline passes.` : "No recovery action applies right now."}</Panel>
			)}
			{d && d.availableActions.length > 0 && (
				<>
					<div className="grid items-start gap-6 md:grid-cols-2">
						<div className="space-y-4">
							<Note tone="yellow" Icon={HiExclamationTriangle} title="Group action needed">
								Members must agree how round {d.round + 1} should recover.
							</Note>
							<InfoList
								rows={[
									{ Icon: HiOutlineUser, label: "Affected member", value: name(d.member) },
									{ Icon: HiBanknotes, label: "Missed contribution", value: formatMoney(d.amount, asset), tone: "pink" },
									{ Icon: HiPauseCircle, label: "Payouts", value: "On hold for recovery", tone: "pink" },
									{ Icon: HiRectangleStack, label: "Round affected", value: `Round ${d.round + 1}` },
								]}
							/>
						</div>
						<div className="space-y-4">
							<p className="text-sm md:text-base">Permitted recovery options</p>
							<div className="space-y-3" role="radiogroup" aria-label="Recovery option">
								{d.availableActions.map((a) => (
									<OptionCard key={a} selected={action === a} onSelect={() => setPicked(a)} Icon={ICONS[a]} title={RECOVERY_ACTIONS[a].label(who)} subtitle={RECOVERY_ACTIONS[a].subtitle(who)} />
								))}
							</div>
							<div className="max-md:hidden md:flex md:justify-end">{next}</div>
						</div>
					</div>
					<Note title="Why the group decides">
						No coordinator can change the cycle alone.{" "}
						{rules.data
							? `A recovery proposal needs ${rules.data.thresholdKind === "percent" ? `${rules.data.thresholdValue}% of eligible members` : `${rules.data.thresholdValue} members`} to vote For`
							: "A recovery proposal must reach the group's threshold"}{" "}
						before SAJI carries it out. {who} doesn&apos;t vote on their own recovery.
					</Note>
					<div className="md:hidden">{next}</div>
				</>
			)}
		</div>
	);
}
