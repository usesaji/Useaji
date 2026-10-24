import { HiOutlineFaceFrown } from "react-icons/hi2";
import { ErrorState } from "@/components/ErrorState";
import { pageRoutes } from "@/lib/routes";
import { LANDING_URL } from "@/lib/site";

export default function NotFound() {
	return (
		<ErrorState
			icon={<HiOutlineFaceFrown />}
			code="404"
			heading="Page Not Found"
			description="The page you're looking for doesn't exist or may have been moved. Let's get you back on track."
			primaryAction={{ label: "Back to Dashboard", href: pageRoutes.dashboardRoutes.OVERVIEW }}
			secondaryAction={{ label: "Visit Homepage", href: LANDING_URL }}
		/>
	);
}
