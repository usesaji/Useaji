import type { PlanDto, SavingsLock } from "@/lib/api/dto";
import { formatMoney, longDate } from "@/lib/format";

/**
 * The four locks a goal can have (`PlanDto.lock`): labels and the rules in plain words. Screens take
 * their copy from here. The contract enforces them; `canWithdraw` says whether money may leave now.
 */
export const LOCK: Record<SavingsLock, { label: string; heading: string; choose: string; intro: string; dated: boolean }> = {
	flexible: {
		label: "Flexible",
		heading: "Flexible savings",
		choose: "Withdraw any time, up to your balance.",
		intro: "Your personal savings, at your own pace.",
		dated: false,
	},
	until_date: {
		label: "Locked until a date",
		heading: "Date-locked savings",
		choose: "Nothing leaves before your chosen date, even if you reach the target early.",
		intro: "Stay committed. Your savings are locked until your release date.",
		dated: true,
	},
	until_target: {
		label: "Locked until the target",
		heading: "Target-locked savings",
		choose: "Withdraw once your balance reaches the target. Dropping below it locks the goal again.",
		intro: "Stay committed. Your savings unlock when you reach your target.",
		dated: false,
	},
	until_date_or_target: {
		label: "Date or target",
		heading: "Date-or-target savings",
		choose: "Withdraw from your chosen date, or as soon as you reach the target — whichever comes first.",
		intro: "Your savings unlock on your release date, or sooner if you reach your target.",
		dated: true,
	},
};

export const LOCKS = Object.keys(LOCK) as SavingsLock[];

/** "Travel fund · Flexible" */
export const planTitle = (plan: Pick<PlanDto, "name" | "lock">) => `${plan.name} · ${LOCK[plan.lock].label}`;

/** Whether the lock itself lets money out now (`canWithdraw` also needs a balance). `now` 0 = not known yet. */
export function lockOpen(plan: PlanDto, now: number) {
	const dateOpen = !!plan.unlockAt && now > 0 && new Date(plan.unlockAt).getTime() <= now;
	const targetOpen = Number(plan.balance) >= Number(plan.target);
	switch (plan.lock) {
		case "flexible":
			return true;
		case "until_date":
			return dateOpen;
		case "until_target":
			return targetOpen;
		case "until_date_or_target":
			return dateOpen || targetOpen;
	}
}

/** What still holds the money: "Locked until Mar 1, 2027" / "Locked until you reach 2,000.00 USDC". */
export function lockReason(plan: PlanDto) {
	const target = formatMoney(plan.target, plan.asset);
	switch (plan.lock) {
		case "flexible":
			return "";
		case "until_date":
			return `Locked until ${longDate(plan.unlockAt)}`;
		case "until_target":
			return `Locked until you reach ${target}`;
		case "until_date_or_target":
			return `Locked until ${longDate(plan.unlockAt)} or until you reach ${target}`;
	}
}

/** When the button can't withdraw: "Available Mar 1" / "Unlocks at target" / "Nothing to withdraw". */
export function withdrawBlocked(plan: PlanDto, now: number) {
	if (!lockOpen(plan, now)) {
		if (plan.lock === "until_target") return "Withdraw · Unlocks at your target";
		return `Withdraw · Available ${longDate(plan.unlockAt)}`;
	}
	return "Nothing to withdraw";
}

export function planRules(plan: PlanDto): string[] {
	const owner = "Only your owner wallet can withdraw, and withdrawals only ever go back to it.";
	const target = formatMoney(plan.target, plan.asset);
	switch (plan.lock) {
		case "flexible":
			return ["Withdraw any time, up to the balance.", owner];
		case "until_date":
			return [`Funds become withdrawable on ${longDate(plan.unlockAt)}.`, "Reaching the target early does not unlock this plan.", owner];
		case "until_target":
			return [
				`Funds become withdrawable once the balance reaches ${target}.`,
				"A withdrawal that takes the balance below the target locks the plan again.",
				owner,
			];
		case "until_date_or_target":
			return [`Funds become withdrawable on ${longDate(plan.unlockAt)}, or as soon as the balance reaches ${target}.`, owner];
	}
}

/** "40% saved · 1,800.00 USDC to go" / "Goal reached" */
export function progressNote(plan: PlanDto) {
	const left = Number(plan.target) - Number(plan.balance);
	return left > 0 ? `${plan.progressPercent}% saved · ${formatMoney(left, plan.asset)} to go` : "Goal reached";
}
