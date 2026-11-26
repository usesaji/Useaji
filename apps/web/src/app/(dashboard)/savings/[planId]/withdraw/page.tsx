"use client";

import { useParams } from "next/navigation";
import { MoveMoney } from "@/features/savings/components/MoveMoney";

/** Withdraw USDC (v3 screen 11). */
export default function WithdrawPage() {
	const { planId } = useParams<{ planId: string }>();
	return <MoveMoney planId={planId} mode="withdraw" />;
}
