"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { HiOutlineCamera } from "react-icons/hi2";
import { toast } from "@repo/ui/sonner";
import { cn } from "@repo/ui/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024; // the API's 5 MB limit
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * An image with an inline upload affordance (profile picture, group cover). Previews the picked file
 * while the upload runs; the caller's mutation updates the stored URL.
 */
export function ImageUpload({
	src,
	placeholder,
	onUpload,
	variant = "avatar",
	editable = true,
	alt = "",
	className,
}: {
	src: string | null | undefined;
	/** Shown when there's no picture: an image URL, or an element (the initials). */
	placeholder: string | React.ReactNode;
	onUpload: (file: File) => Promise<unknown>;
	variant?: "avatar" | "banner";
	editable?: boolean;
	alt?: string;
	className?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const shown = preview ?? (src || (typeof placeholder === "string" ? placeholder : ""));

	const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-selecting the same file
		if (!file) return;
		if (!ACCEPTED.includes(file.type)) return void toast.error("Unsupported file", { description: "Use a JPG, PNG, or WebP image." });
		if (file.size > MAX_BYTES) return void toast.error("File too large", { description: "The image must be 5 MB or smaller." });
		const localUrl = URL.createObjectURL(file);
		setPreview(localUrl);
		setUploading(true);
		try {
			await onUpload(file);
		} finally {
			setPreview(null);
			URL.revokeObjectURL(localUrl);
			setUploading(false);
		}
	};

	const shape = variant === "avatar" ? "h-16 w-16 rounded-full" : "h-36 w-full rounded-2xl md:h-48 lg:h-52";

	return (
		<div className={cn("relative overflow-hidden bg-primary-light", shape, className)}>
			{shown ? <img src={shown} alt={alt} className="h-full w-full object-cover" /> : placeholder}
			{editable && (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={uploading}
					aria-label="Upload image"
					className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
				>
					{uploading ? <span className="text-xs">Uploading…</span> : <HiOutlineCamera className="text-2xl" />}
				</button>
			)}
			<input ref={inputRef} type="file" accept={ACCEPTED.join(",")} onChange={onFile} className="hidden" />
		</div>
	);
}
