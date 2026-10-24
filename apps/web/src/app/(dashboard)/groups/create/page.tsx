import type { Metadata } from "next";
import { CreateGroupForm } from "@/features/groups/components/CreateGroupForm";

export const metadata: Metadata = { title: "Create a Group" };

export default function CreateGroupPage() {
	return (
		<div className="w-full pb-10">
			<CreateGroupForm />
		</div>
	);
}
