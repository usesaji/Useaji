"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";
import { TbCurrencyDollar } from "react-icons/tb";
import type { GroupsOverviewDto, WalletSummaryDto } from "@/lib/api/dto";
import { Money } from "@/components/Money";
import { formatMoney, relative } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

/**
 * The dashboard hero: what the user has saved in groups (`GET /groups/overview` totalSaved), what
 * groups have paid out to them (`GET /wallet` totalPaidOut — payouts go straight to their wallet),
 * and the soonest contribution due (`overview.nextDue`), which Quick Deposit opens.
 */
export function SavingsSummaryCard({ overview, wallet }: { overview: GroupsOverviewDto | undefined; wallet: WalletSummaryDto | undefined }) {
	const [hidden, setHidden] = useState(false);
	const now = useNow();
	const asset = overview?.asset ?? "USDC";
	const saved = Number(overview?.totalSaved ?? 0);
	const paidOut = Number(wallet?.totalPaidOut ?? 0);
	const due = overview?.nextDue ?? null;

	const depositHref = due ? pageRoutes.dashboardRoutes.CIRCLE(due.groupId) : pageRoutes.dashboardRoutes.GROUPS;
	const amount = hidden ? "••••••" : overview ? <Money amount={saved} /> : "…";

	const detail = hidden
		? null
		: saved === 0 && paidOut === 0
			? (overview?.activeGroups ?? 0) > 0
				? "Nothing saved yet — it shows here after your first contribution"
				: "Join or create a group to start saving"
			: [saved > 0 ? `${formatMoney(saved, asset)} working in groups` : null, paidOut > 0 ? `${formatMoney(paidOut, asset)} paid out to you` : null]
					.filter(Boolean)
					.join(" · ");

	const dueNote = due && (
		<p className="text-[11px] text-white/80 md:text-sm">
			{formatMoney(due.amount, asset)} due{now ? ` ${relative(due.deadline, now)}` : ""} · {due.groupName}
		</p>
	);

	return (
		<section className="relative overflow-hidden rounded-[20px] bg-primary px-5 pt-6 pb-5 text-white md:rounded-[30px] md:px-12 md:py-12">
			<img src="/images/wallet-vector.svg" alt="" aria-hidden className="animate-float pointer-events-none absolute -right-6 -bottom-6 origin-bottom-right md:right-0 md:bottom-0 md:scale-[2.4]" />
			<img src="/images/wallet-flower.svg" alt="" aria-hidden className="pointer-events-none absolute right-[14%] bottom-0 h-36 max-md:hidden" />

			<div className="relative flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-3 text-xs md:text-lg">
						<span className="md:hidden">
							<span className="font-medium">{asset}</span> · Group Savings
						</span>
						<span className="max-md:hidden">Total Group Savings</span>
						<span className="rounded-full bg-primary-dark px-4 py-1.5 text-xs font-medium max-md:ml-auto md:py-2 md:text-sm">{asset}</span>
					</div>
					<div className="mt-3 flex items-center gap-3 md:mt-4 md:gap-5">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white text-xl md:hidden">
							<TbCurrencyDollar />
						</span>
						<h2 className="truncate text-[40px] leading-none font-medium tracking-tight md:text-[72px]">{amount}</h2>
						<button type="button" onClick={() => setHidden((h) => !h)} aria-label={hidden ? "Show balance" : "Hide balance"} className="shrink-0 text-2xl md:text-4xl">
							{hidden ? <IoEyeOutline /> : <IoEyeOffOutline />}
						</button>
					</div>
					{detail && <p className="mt-2 text-[11px] font-light text-white/85 md:mt-3 md:text-sm">{detail}</p>}
				</div>

				<div className="flex flex-col items-end gap-3 max-md:hidden">
					<QuickDeposit href={depositHref} />
					{dueNote}
				</div>

				<div className="space-y-3 md:hidden">
					{dueNote}
					<div className="flex items-center justify-between gap-3">
						<QuickDeposit href={depositHref} />
						<Link
							href={pageRoutes.dashboardRoutes.NEW_GROUP}
							aria-label="Create a group"
							className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-dark text-lg"
						>
							<FiPlus />
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}

function QuickDeposit({ href }: { href: string }) {
	return (
		<Link href={href} className="flex shrink-0 items-center gap-2 rounded-full bg-primary-dark px-5 py-2.5 text-xs transition hover:bg-primary-dark-hover md:px-16 md:py-5 md:text-lg">
			Quick Deposit <FiPlus className="text-sm md:text-xl" />
		</Link>
	);
}
