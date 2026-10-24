"use client";

/* eslint-disable @next/next/no-img-element */
import { FaCalendarCheck } from "react-icons/fa";
import { HiMiniUsers, HiOutlineScale } from "react-icons/hi2";
import { PiWarningCircleFill } from "react-icons/pi";
import { RiMoneyDollarCircleFill, RiPercentFill } from "react-icons/ri";
import { ImageUpload } from "@/components/ImageUpload";
import { MemberAvatars } from "@/components/MemberAvatars";
import { GROUP_PLACEHOLDER } from "@/features/groups/view";
import type { GovernanceSettingsDto, GroupDetailDto } from "@/lib/api/dto";
import { formatMoney, frequencyLabel, labelize } from "@/lib/format";

const GRACE_POLICY: Record<GroupDetailDto["missedGracePolicy"], string> = {
	charge_late_fee: "Late fee is charged",
	start_recovery: "Group recovery vote",
};

/** A group's banner, target, members and settings — the forming page and the invite preview. */
export function GroupPreview({
	group,
	rules,
	onBannerUpload,
	children,
}: {
	group: GroupDetailDto;
	/** The approval rules, for members (`GET /groups/{id}/governance` is members only). */
	rules?: GovernanceSettingsDto;
	/** Admins can replace the cover photo in place. */
	onBannerUpload?: (file: File) => Promise<unknown>;
	/** The "Join the Others" card's actions. */
	children?: React.ReactNode;
}) {
	const fee = group.lateFee ? (group.lateFee.kind === "fixed" ? formatMoney(group.lateFee.value, group.asset) : `${group.lateFee.value}%`) : "None";
	const rows = [
		{ Icon: HiMiniUsers, label: "Group Type", value: `Rotating · ${group.publicDiscovery ? "Public" : "Private"}` },
		{ Icon: RiMoneyDollarCircleFill, label: "Contribution", value: formatMoney(group.contributionAmount, group.asset) },
		{ Icon: RiMoneyDollarCircleFill, label: "Payout Order", value: labelize(group.payoutOrder) },
		{ Icon: FaCalendarCheck, label: "Frequency", value: frequencyLabel(group.frequency, group.customIntervalDays) },
		{ Icon: RiPercentFill, label: "Service Charge", value: `${group.serviceChargePercent}%` },
		...(rules
			? [{ Icon: HiOutlineScale, label: "Decisions pass at", value: rules.thresholdKind === "percent" ? `${rules.thresholdValue}% of members` : `${rules.thresholdValue} yes votes` }]
			: []),
		{ Icon: PiWarningCircleFill, label: "Late Penalty", value: `${fee} after ${group.gracePeriodDays} day${group.gracePeriodDays === 1 ? "" : "s"}`, danger: true },
		{ Icon: PiWarningCircleFill, label: "After the grace period", value: GRACE_POLICY[group.missedGracePolicy], danger: true },
	];

	return (
		<div className="mt-4 md:mt-6">
			<h2 className="text-xl md:text-3xl">{group.name}</h2>
			<div className="mt-3">
				{onBannerUpload ? (
					<ImageUpload variant="banner" src={group.coverUrl} placeholder={GROUP_PLACEHOLDER} alt={`${group.name} cover`} onUpload={onBannerUpload} />
				) : (
					<div className="h-36 overflow-hidden rounded-2xl md:h-48 lg:h-52">
						<img alt="" src={group.coverUrl ?? GROUP_PLACEHOLDER} className="h-full w-full object-cover" />
					</div>
				)}
			</div>

			<section className="mt-3 flex flex-col gap-2 md:mt-5 md:flex-row md:gap-4">
				<div className="min-w-0 rounded-2xl bg-[#f7f7f7] p-4 md:flex-1 md:p-6">
					<h5 className="text-xs font-light md:text-sm">Target Goal</h5>
					<h3 className="mt-1 max-w-full truncate text-2xl font-medium md:mt-2 md:text-3xl lg:text-4xl">{formatMoney(group.targetAmount, group.asset)}</h3>
				</div>
				<div className="rounded-2xl bg-[#f7f7f7] p-4 md:flex-1 md:p-6">
					<h5 className="text-xs font-light md:text-sm">
						{group.memberCount} {group.memberCount === 1 ? "Member" : "Members"}
					</h5>
					<div className="mt-2">
						<MemberAvatars members={group.membersPreview} total={group.memberCount} />
					</div>
				</div>
			</section>

			<section className="mt-5 md:mt-7">
				<h3 className="md:text-xl">Group Settings</h3>
				<div className="mt-3 space-y-3 md:mt-5 md:space-y-4">
					{rows.map(({ Icon, label, value, danger }, i) => (
						<div key={label} className={`flex items-center justify-between gap-3 pb-2 ${i < rows.length - 1 ? "border-b border-b-[#d9d9d9]" : ""}`}>
							<div className="flex items-center gap-1 md:gap-2">
								<Icon className={`text-xl ${danger ? "text-[#FF0000]" : "text-primary"}`} />
								<p className="text-sm font-light md:text-base md:font-normal">{label}</p>
							</div>
							<div className="text-right text-sm font-medium md:text-base">{value}</div>
						</div>
					))}
				</div>
			</section>

			{children && (
				<section className="mt-5">
					<div className="rounded-2xl bg-[#f7f7f7] p-4 md:p-6">
						<h5 className="text-base md:font-medium lg:text-xl">Join the Others</h5>
						<div className="mt-2 text-xs font-light md:w-2/3 md:text-sm lg:text-base">
							{group.autoApproval ? "This group admits members instantly." : "The admin will confirm your request to join."}
						</div>
						<div className="mt-4 md:mt-6">
							<MemberAvatars members={group.membersPreview} total={group.memberCount} />
						</div>
					</div>
					<div className="mt-5 md:mt-7">{children}</div>
				</section>
			)}
		</div>
	);
}
