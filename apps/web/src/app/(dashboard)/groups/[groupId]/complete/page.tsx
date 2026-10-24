"use client";

import { useParams } from "next/navigation";
import { LuTarget } from "react-icons/lu";
import { GoBack } from "@/components/GoBack";
import { LinkButton } from "@/components/LinkButton";
import { MemberAvatars } from "@/components/MemberAvatars";
import { useActivity } from "@/features/activity/hooks";
import { useCycle } from "@/features/circle/hooks";
import { useGroup } from "@/features/groups/hooks";
import { formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * "Cycle Completed!" — after the rotation completes: what the group paid out (`CycleDto.totalPaidOut`)
 * and what the viewer contributed (`GET /activity?groupId=`).
 */
export default function GroupCompletePage() {
	const { groupId } = useParams<{ groupId: string }>();
	const { data: group } = useGroup(groupId);
	const { data: cycle } = useCycle(groupId);
	const mine = useActivity({ groupId, type: "contribution", limit: 100 });

	const asset = group?.asset ?? "USDC";
	const total = Number(cycle?.totalPaidOut ?? 0);
	const yours = (mine.data?.results ?? []).reduce((sum, a) => sum + Number(a.amount), 0);
	const members = (cycle?.schedule ?? []).map((s) => s.member);

	return (
		<div className="mx-auto max-w-lg pb-10">
			<GoBack href={pageRoutes.dashboardRoutes.CIRCLE(groupId)} />
			<div className="py-10 text-center">
				<div className="animate-pop mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#efeaff] text-primary">
					<LuTarget className="text-5xl" />
				</div>
				<h2 className="mt-6 text-2xl font-medium">{group?.status === "completed" ? "Cycle Completed!" : "Almost there"}</h2>
				<p className="mt-2 text-sm text-ink-muted">
					{group?.status === "completed" ? "Together you've reached the finish line. Every contribution paid off — nice work." : "This group is still running. Here's how far it has come."}
				</p>
				<div className="mt-8 grid grid-cols-2 gap-3 text-left">
					<div className="rounded-2xl bg-primary p-4 text-white">
						<p className="text-xs font-light">Paid out to members</p>
						<p className="mt-1 text-2xl font-medium">{formatMoney(total, asset)}</p>
					</div>
					<div className="rounded-2xl bg-[#efeaff] p-4 text-primary">
						<p className="text-xs font-light">Your Contributions</p>
						<p className="mt-1 text-2xl font-medium">{formatMoney(yours, asset)}</p>
					</div>
				</div>
				<div className="mt-4 rounded-2xl bg-[#f7f7f7] p-4 text-left">
					<p className="text-sm font-medium">Keep the momentum</p>
					<p className="text-xs font-light text-ink-muted">Join or start another group and keep growing together.</p>
					{members.length > 0 && (
						<div className="mt-3">
							<MemberAvatars members={members.slice(0, 4)} total={members.length} />
						</div>
					)}
				</div>
				<p className="mt-8 text-sm text-ink-muted">Your payout went straight to your wallet when your round paid out.</p>
				<LinkButton href={pageRoutes.dashboardRoutes.WALLET} className="mt-3 w-full">
					See your payouts
				</LinkButton>
				<LinkButton href={pageRoutes.dashboardRoutes.OVERVIEW} variant="outline" className="mt-3 w-full">
					Go to Home
				</LinkButton>
			</div>
		</div>
	);
}
