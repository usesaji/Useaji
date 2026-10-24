import { redirect } from "next/navigation";
import { pageRoutes } from "@/lib/routes";

// Details are edited field by field on Personal Info; this route stays so old links keep working.
export default function Page() {
	redirect(pageRoutes.dashboardRoutes.PROFILE_PERSONAL_INFO);
}
