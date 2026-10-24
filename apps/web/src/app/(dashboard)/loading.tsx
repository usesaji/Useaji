import { PageLoader } from "@repo/ui/page-loader";

/** Route transitions inside the dashboard (and the Suspense boundary pages using search params need). */
export default function Loading() {
	return <PageLoader variant="section" />;
}
