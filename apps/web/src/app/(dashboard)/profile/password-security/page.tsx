import { redirect } from "next/navigation";
import { pageRoutes } from "@/lib/routes";

// Password & Security lives at /profile/security; this route stays so old links keep working.
export default function Page() {
	redirect(pageRoutes.dashboardRoutes.PROFILE_SECURITY);
}
