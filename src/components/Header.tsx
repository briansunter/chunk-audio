import { Badge } from "@/components/ui/badge";

export default function Header() {
	return (
		<header className="relative z-20 border-b border-border shrink-0">
			<div className="mx-auto app-container flex h-11 items-center px-4">
				<div className="flex items-center gap-2">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						className="text-primary"
						aria-hidden="true"
					>
						<path
							d="M9 18V5l12-2v13"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<circle
							cx="6"
							cy="18"
							r="3"
							fill="currentColor"
							opacity="0.3"
							stroke="currentColor"
							strokeWidth="2"
						/>
						<circle
							cx="18"
							cy="16"
							r="3"
							fill="currentColor"
							opacity="0.3"
							stroke="currentColor"
							strokeWidth="2"
						/>
					</svg>
					<h1 className="text-sm font-semibold tracking-wide">
						<span className="text-primary">Chunk</span>Audio
					</h1>
				</div>

				<Badge
					variant="outline"
					className="ml-auto text-[9px] font-mono uppercase tracking-wider"
				>
					Local only
				</Badge>
			</div>
		</header>
	);
}
