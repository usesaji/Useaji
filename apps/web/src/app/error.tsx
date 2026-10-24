"use client";

import { useEffect } from "react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { ErrorState } from "@/components/ErrorState";
import { pageRoutes } from "@/lib/routes";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<ErrorState
			icon={<HiOutlineExclamationTriangle />}
			code="ERROR"
			heading="Something Went Wrong"
			description="We hit an unexpected error while loading this page. Try again, or head back to the dashboard."
			primaryAction={{ label: "Try Again", onClick: retry }}
			secondaryAction={{ label: "Back to Dashboard", href: pageRoutes.dashboardRoutes.OVERVIEW }}
		/>
	);
}
