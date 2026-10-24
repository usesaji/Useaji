"use client";

import { useParams } from "next/navigation";
import { GoBack } from "@/components/GoBack";
import { LinkButton } from "@/components/LinkButton";
import { QueryState } from "@repo/ui/query-state";
import { useGovernance } from "@/features/governance/hooks";
import { CreateGroupForm } from "@/features/groups/components/CreateGroupForm";
import { useGroup } from "@/features/groups/hooks";
import { pageRoutes } from "@/lib/routes";

/** Edit a forming group's settings and approval rules (`PATCH /groups/{id}`, `PUT …/governance`). Admins only. */
export default function EditGroupPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const group = useGroup(groupId);
	const rules = useGovernance(groupId);
	const g = group.data;

	if (!g || !rules.data) {
		return (
			<div className="w-full max-w-4xl pb-10">
				<GoBack href={pageRoutes.dashboardRoutes.GROUP(groupId)} />
				<QueryState
					isLoading={group.isLoading || rules.isLoading}
					error={group.error ?? rules.error}
					onRetry={() => void (group.refetch(), rules.refetch())}
					className="mt-6"
				/>
			</div>
		);
	}

	if (g.myRole !== "admin" || g.status !== "forming") {
		return (
			<div className="mx-auto max-w-md py-16 text-center">
				<h2 className="text-2xl">Settings are locked</h2>
				<p className="mt-2 text-sm font-light text-ink-muted">
					{g.status !== "forming" ? "The cycle has started, so the settings can't change now." : "Only the group's admins can edit its settings."}
				</p>
				<LinkButton href={pageRoutes.dashboardRoutes.GROUP(groupId)} className="mt-8 w-full">
					Back to the group
				</LinkButton>
			</div>
		);
	}

	return (
		<div className="w-full pb-10">
			<CreateGroupForm editing={{ group: g, rules: rules.data }} />
		</div>
	);
}
