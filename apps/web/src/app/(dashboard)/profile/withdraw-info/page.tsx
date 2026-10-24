"use client";

import { useState } from "react";
import { HiOutlineWallet } from "react-icons/hi2";
import { IoAddOutline } from "react-icons/io5";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { AddDestinationModal } from "@/features/wallet/components/AddDestinationModal";
import { useDestinationActions, useDestinations } from "@/features/wallet/hooks";
import { longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * Payout addresses (`/wallet/destinations`). Payouts go straight to the primary one (else to the
 * linked wallet); adding one or changing the primary asks for the password (`withIdentity`).
 */
export default function WithdrawInfoPage() {
	const { data, isLoading, error, refetch } = useDestinations();
	const { makePrimary, remove } = useDestinationActions();
	const [adding, setAdding] = useState(false);
	const list = data ?? [];

	return (
		<div className="w-full max-w-3xl space-y-6 pb-10">
			<PageHeader
				title="Payout Addresses"
				subtitle="Payouts go straight to your primary address — or to your linked wallet if you have none."
				back
				backHref={pageRoutes.dashboardRoutes.ME}
				actions={
					<button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs text-white md:text-sm">
						<IoAddOutline /> Add
					</button>
				}
			/>
			<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} skeletonClassName="h-28" />
			{data && list.length === 0 && (
				<div className="rounded-[20px] border border-dashed border-neutral-light-active px-6 py-10 text-center text-sm">No addresses saved yet. Payouts go to your linked wallet; add another address to send them elsewhere.</div>
			)}
			<ul className="stagger space-y-3">
				{list.map((d) => (
					<li key={d.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-panel px-5 py-4">
						<div className="flex min-w-0 items-center gap-3">
							<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-lg text-primary">
								<HiOutlineWallet />
							</span>
							<div className="min-w-0">
								<p className="flex items-center gap-2 text-sm font-medium">
									{d.label ?? "Wallet"}
									{d.isPrimary && <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] text-primary">Primary</span>}
								</p>
								<p className="truncate font-mono text-xs text-ink-muted" title={d.address}>
									{d.address}
								</p>
								<p className="text-[11px] font-light">Added {longDate(d.createdAt)}</p>
							</div>
						</div>
						<div className="flex shrink-0 gap-3 text-xs">
							{!d.isPrimary && (
								<button type="button" onClick={() => makePrimary.mutate(d.id)} disabled={makePrimary.isPending} className="text-primary underline disabled:opacity-50">
									Make primary
								</button>
							)}
							<button type="button" onClick={() => remove.mutate(d.id)} disabled={remove.isPending} className="text-accent underline disabled:opacity-50">
								Remove
							</button>
						</div>
					</li>
				))}
			</ul>
			{adding && <AddDestinationModal onClose={() => setAdding(false)} />}
		</div>
	);
}
