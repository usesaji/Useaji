"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { ApprovalRules, rulesError } from "@/features/governance/components/ApprovalRules";
import { useGovernance, useSetGovernance } from "@/features/governance/hooks";
import { useGroup } from "@/features/groups/hooks";
import type { GovernanceSettingsDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

/** Approval rules (`GET/PUT /groups/{id}/governance`): editable by the admin until the cycle starts. */
export default function RulesPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const { data: group } = useGroup(groupId);
	const rules = useGovernance(groupId);
	const save = useSetGovernance(groupId);
	const [draft, setDraft] = useState<GovernanceSettingsDto | null>(null);
	const value = draft ?? rules.data;
	const editable = group?.myRole === "admin" && group.status === "forming";

	return (
		<div className="w-full max-w-4xl space-y-6 pb-10">
			<PageHeader
				title="Approval Rules"
				subtitle={editable ? "How the group makes decisions. These lock when the cycle starts." : "How this group makes decisions."}
				back
				backHref={group?.status === "forming" ? pageRoutes.dashboardRoutes.GROUP(groupId) : pageRoutes.dashboardRoutes.CIRCLE(groupId)}
			/>
			<QueryState isLoading={rules.isLoading} error={rules.error} onRetry={() => void rules.refetch()} />
			{value &&
				(editable ? (
					<>
						<ApprovalRules value={value} onChange={setDraft} />
						<Button onClick={() => save.mutate(value, { onSuccess: () => setDraft(null) })} isLoading={save.isPending} disabled={!draft || !!rulesError(value)}>
							Save Rules
						</Button>
					</>
				) : (
					<div className="space-y-3 rounded-[14px] bg-panel p-5 text-sm">
						<Row label="A decision passes at" value={value.thresholdKind === "percent" ? `${value.thresholdValue}% of eligible members` : `${value.thresholdValue} yes votes`} />
						<Row label="Voting stays open" value={`${value.votingPeriodHours} hours`} />
						<Row label="An approved decision must be carried out within" value={`${value.executionWindowHours} hours`} />
						<p className="pt-2 text-xs font-light text-ink-muted">Members in default can&apos;t vote on their own recovery. Set by the admin before the cycle started.</p>
					</div>
				))}
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-neutral-light pb-3 last:border-0">
			<span className="font-light">{label}</span>
			<span className="text-right">{value}</span>
		</div>
	);
}
