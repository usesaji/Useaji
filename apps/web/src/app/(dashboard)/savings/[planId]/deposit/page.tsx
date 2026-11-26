"use client";

import { useParams } from "next/navigation";
import { MoveMoney } from "@/features/savings/components/MoveMoney";

/** Deposit USDC (v3 screen 10). */
export default function DepositPage() {
	const { planId } = useParams<{ planId: string }>();
	return <MoveMoney planId={planId} mode="deposit" />;
}
