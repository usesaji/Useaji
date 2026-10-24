/** Each signed-in page eases in on navigation (opacity and a 6px rise; none with reduced motion). */
export default function Template({ children }: { children: React.ReactNode }) {
	return <div className="animate-page">{children}</div>;
}
