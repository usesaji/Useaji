import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import { pageRoutes } from "@/lib/routes";

/** Floating "create a group" button. Phones only by default; `desktop` shows it on wide screens too, dark. */
export function CreateGroupFloatBtn({ desktop = false }: { desktop?: boolean }) {
	return (
		<Link
			href={pageRoutes.dashboardRoutes.NEW_GROUP}
			aria-label="Create a group"
			className={`fixed right-[6%] bottom-[12%] z-100 flex h-15 w-15 cursor-pointer items-center justify-center rounded-full bg-primary duration-150 hover:scale-[0.9] active:scale-[1.1] sm:h-20 sm:w-20 ${
				desktop ? "lg:right-10 lg:bottom-10 lg:bg-neutral-dark lg:shadow-lg" : "lg:hidden"
			}`}
		>
			<FiPlus className="text-4xl text-white" />
		</Link>
	);
}
