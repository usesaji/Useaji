"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { ACTIVITY_LABEL } from "@/features/activity/components/ActivityCard";
import { useActivityItem } from "@/features/activity/hooks";
import { formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * Transaction Details for one activity item (`GET /activity/{id}`). `txUrl` is null until the
 * Stellar payment confirms (a payout shows a `payout:` placeholder hash meanwhile; simulated groups
 * a `simulated:` id), so the status and the explorer link follow it.
 */
export default function TransactionPage() {
	const { id } = useParams<{ id: string }>();
	const { data, isLoading, error, refetch } = useActivityItem(id);
	const simulated = data?.txHash.startsWith("simulated:") ?? false;
	const status = !data ? null : data.txUrl ? { label: "Completed", tone: "bg-success-50 text-success-700" } : simulated ? { label: "Simulated", tone: "bg-neutral-comment text-ink" } : { label: "Confirming on Stellar", tone: "bg-warning-50 text-warning-900" };

	return (
		<div className="w-full max-w-2xl space-y-6 pb-10">
			<PageHeader title={data ? ACTIVITY_LABEL[data.kind] : "Transaction"} back actions={status && <span className={`rounded-full px-3 py-1.5 text-xs ${status.tone}`}>{status.label}</span>} />
			<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} skeletonClassName="h-64" />
			{data && (
				<>
					<section className="rounded-[20px] bg-primary px-6 py-7 text-white md:px-8">
						<p className="text-xs md:text-sm">Amount</p>
						<p className="mt-1 text-4xl font-medium md:text-5xl">{formatMoney(data.amount, data.asset)}</p>
					</section>
					<section className="rounded-[20px] bg-panel px-6 py-2">
						<Row label="Type" value={ACTIVITY_LABEL[data.kind]} />
						<Row
							label="Group"
							value={
								data.group ? (
									<Link href={pageRoutes.dashboardRoutes.CIRCLE(data.group.id)} className="text-primary underline-offset-4 hover:underline">
										{data.group.name}
									</Link>
								) : (
									"—"
								)
							}
						/>
						<Row
							label="Transaction"
							value={
								data.txUrl ? (
									<span className="font-mono text-xs" title={data.txHash}>
										{`${data.txHash.slice(0, 10)}…${data.txHash.slice(-10)}`}
									</span>
								) : simulated ? (
									"Not on Stellar (simulated)"
								) : (
									"Confirming…"
								)
							}
						/>
						<Row label="Date & Time" value={new Date(data.createdAt).toLocaleString()} />
					</section>
					{data.txUrl && (
						<a href={data.txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
							Verify on Stellar explorer <HiArrowTopRightOnSquare />
						</a>
					)}
				</>
			)}
		</div>
	);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-neutral-light py-3.5 last:border-0">
			<span className="text-sm font-light">{label}</span>
			<span className="text-right text-sm">{value}</span>
		</div>
	);
}
