import { redirect } from "next/navigation";
import { pageRoutes } from "@/lib/routes";

/** The app's root: the dashboard (the session gate sends signed-out visitors to log in). */
export default function Home() {
	redirect(pageRoutes.dashboardRoutes.OVERVIEW);
}
