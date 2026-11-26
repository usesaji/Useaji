import Link from "next/link";
import { IoIosArrowRoundForward } from "react-icons/io";
import type { ActivityItemDto } from "@/lib/api/dto";
import { dateTime, formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { explorerTxUrl } from "@/lib/stellar/config";

export const ACTIVITY_LABEL: Record<ActivityItemDto["kind"], string> = {
	contribution: "Contribution Sent",
	payout: "Payout Received",
	withdrawal: "Withdrawal Sent",
	savings_deposit: "Savings Deposit",
	savings_withdrawal: "Savings Withdrawal",
	slot_purchase: "Slot Purchased",
	slot_sale: "Slot Sold",
};

/** "in Summer Fund." / "into Travel fund." / "to your wallet." */
function where(a: ActivityItemDto) {
	if (a.plan) return a.kind === "savings_withdrawal" ? `from ${a.plan.name} to your wallet.` : `into ${a.plan.name}.`;
	if (a.kind === "slot_purchase") return a.group ? `for a slot in ${a.group.name}.` : "for a slot.";
	if (a.kind === "slot_sale") return a.group ? `for your slot in ${a.group.name}.` : "for your slot.";
	return a.group ? `in ${a.group.name}.` : "to your wallet.";
}

export function ActivityCard({ activity }: { activity: ActivityItemDto }) {
	return (
		<div className="rounded-xl bg-panel px-2 py-4 md:px-6 md:py-5">
			<div className="flex items-start gap-1">
				<ActivityGlyph />
				<div className="min-w-0">
					<h5 className="flex flex-wrap items-center gap-x-3">
						<Link href={pageRoutes.dashboardRoutes.TRANSACTION(activity.id)} className="text-sm font-medium hover:text-primary">
							{ACTIVITY_LABEL[activity.kind]}
						</Link>
						<span className="text-xs">{dateTime(activity.createdAt)}</span>
					</h5>
					<p className="mt-2 text-sm leading-[122%] font-light md:mt-4">
						{formatMoney(activity.amount, activity.asset)} {where(activity)}
					</p>
					<a href={explorerTxUrl(activity.txHash)} target="_blank" rel="noreferrer" className="mt-2 flex items-center text-primary md:mt-4">
						<span className="text-sm">View Transaction</span>
						<IoIosArrowRoundForward className="text-lg md:text-2xl" />
					</a>
				</div>
			</div>
		</div>
	);
}

/** The pink coins disc. */
export function ActivityGlyph({ className = "scale-[0.8]" }: { className?: string }) {
	return (
		<svg className={`shrink-0 ${className}`} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
			<rect width="47.0553" height="47.0553" rx="23.5277" fill="#FFE6F3" />
			<path
				d="M22.6812 13.5006C22.2277 13.3418 21.5917 13.4955 21.2607 13.8436L16.7278 18.6104C16.3968 18.9585 16.496 19.3693 16.9494 19.5282L27.7254 23.3004C28.1789 23.4591 28.8147 23.3056 29.1459 22.9575L33.6788 18.1907C34.0098 17.8424 33.9106 17.4316 33.4572 17.2729L22.6812 13.5006Z"
				fill="#FF0084"
			/>
			<path
				d="M21.3784 22.9897C20.925 22.8308 20.289 22.9844 19.958 23.3325L15.4251 28.0994C15.0941 28.4475 15.1932 28.8584 15.6466 29.017L26.4227 32.7893C26.8761 32.9481 27.512 32.7946 27.8431 32.4464L32.3759 27.6795C32.707 27.3314 32.6077 26.9206 32.1543 26.7618L21.3784 22.9897Z"
				fill="#FF0084"
			/>
		</svg>
	);
}
