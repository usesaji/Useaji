/** Console pages fade in on navigation — quietly; this is a tool. */
export default function Template({ children }: { children: React.ReactNode }) {
	return <div className="animate-fade">{children}</div>;
}
