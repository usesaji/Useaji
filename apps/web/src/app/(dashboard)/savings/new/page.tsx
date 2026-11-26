"use client";

import { QueryState } from "@repo/ui/query-state";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { ConnectWalletPanel } from "@/features/savings/components/ConnectWalletPanel";
import { CreateGoalForm } from "@/features/savings/components/CreateGoalForm";
import { pageRoutes } from "@/lib/routes";

/** Create a savings goal (v3 screen 08). The linked wallet will own the plan, so it needs one first (screen 13). */
export default function NewSavingsGoalPage() {
	const account = useAccount();
	return (
		<div className="w-full space-y-6 pb-10">
			<QueryState isLoading={account.isLoading} error={account.error} onRetry={() => void account.refetch()} />
			{account.data && !account.data.wallet && <ConnectWalletPanel />}
			{account.data?.wallet && (
				<>
					<PageHeader
						title="Create a savings goal"
						subtitle="Make room for what matters to you."
						back
						backHref={pageRoutes.dashboardRoutes.SAVINGS}
					/>
					<CreateGoalForm ownerAddress={account.data.wallet.publicKey} />
				</>
			)}
		</div>
	);
}
