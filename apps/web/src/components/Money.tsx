"use client";

import { AnimatedNumber } from "@repo/ui/animated-number";
import { formatMoney } from "@/lib/format";

/** An amount that counts up to its value (and from the old one when it changes): balances, totals. */
export function Money({ amount, asset }: { amount: string | number | null | undefined; asset?: string }) {
	const n = amount === null || amount === undefined || amount === "" ? NaN : Number(amount);
	if (Number.isNaN(n)) return <>{formatMoney(amount, asset)}</>;
	return <AnimatedNumber value={n} format={(v) => formatMoney(v, asset)} />;
}
