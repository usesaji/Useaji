"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toasts in the Saji style: tinted cards at the top right (lilac success, red error, grey info,
 * yellow warning). Call `toast.success("Title", { description })` from `@repo/ui/sonner`.
 */
const Toaster = (props: ToasterProps) => (
	<Sonner
		position="top-right"
		closeButton
		toastOptions={{
			unstyled: true,
			classNames: {
				toast:
					"group relative flex w-full items-start gap-3 rounded-[15px] border-[0.3px] border-[#A7A7A74D] p-5 pr-10 font-sans backdrop-blur-[14.2px] shadow-sm sm:w-[400px]",
				title: "text-base font-medium",
				description: "mt-0.5 text-xs opacity-90",
				closeButton: "absolute! top-3! right-3! left-auto! transform-none! border-0! bg-transparent! text-current!",
				success: "bg-[#ECE6FE] text-[#1D006E]",
				error: "bg-[#FFE2E2] text-[#8E0000]",
				info: "bg-[#E8E8E9] text-[#161A21]",
				warning: "bg-[#FEFCEA] text-[#853800]",
				default: "bg-[#E8E8E9] text-[#161A21]",
			},
		}}
		{...props}
	/>
);

export { Toaster };
export { toast } from "sonner";
