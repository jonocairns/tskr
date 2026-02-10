"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	getPresetIconLabel,
	PRESET_ICON_OPTIONS,
	PresetIconGlyph,
	resolvePresetIconKey,
} from "@/components/task-actions/presetIcons";
import { Command, CommandInput } from "@/components/ui/Command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import type { PresetIconKey } from "@/lib/presetIcons";
import { cn } from "@/lib/utils";

type PresetIconPickerProps = {
	id: string;
	value: PresetIconKey | null;
	onChange: (value: PresetIconKey | null) => void;
	disabled?: boolean;
	placeholder?: string;
	searchPlaceholder?: string;
	noneLabel?: string;
	noResultsLabel?: string;
};

const ROW_HEIGHT = 36;
const LIST_MAX_HEIGHT = 300;
const OVERSCAN_ROWS = 8;

export const PresetIconPicker = ({
	id,
	value,
	onChange,
	disabled = false,
	placeholder = "Pick an icon",
	searchPlaceholder = "Search icons...",
	noneLabel = "No icon",
	noResultsLabel = "No icon found.",
}: PresetIconPickerProps) => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(LIST_MAX_HEIGHT);
	const viewportRef = useRef<HTMLDivElement | null>(null);

	const resolvedValue = resolvePresetIconKey(value);
	const activeValue = resolvedValue ?? "__none__";
	const triggerLabel = value ? getPresetIconLabel(value) : placeholder;
	const filteredIconOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return PRESET_ICON_OPTIONS;
		}
		return PRESET_ICON_OPTIONS.filter((iconOption) => iconOption.searchValue.includes(normalizedQuery));
	}, [query]);
	const totalRowsHeight = filteredIconOptions.length * ROW_HEIGHT;
	const visibleRowCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
	const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
	const endIndex = Math.min(filteredIconOptions.length, startIndex + visibleRowCount);
	const visibleRows = filteredIconOptions.slice(startIndex, endIndex);
	const handleQueryChange = (nextQuery: string) => {
		setQuery(nextQuery);
		if (viewportRef.current) {
			viewportRef.current.scrollTop = 0;
		}
		setScrollTop(0);
	};

	useEffect(() => {
		if (!open) {
			return;
		}
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}

		const updateViewportHeight = () => {
			setViewportHeight(viewport.clientHeight || LIST_MAX_HEIGHT);
		};

		updateViewportHeight();
		const resizeObserver = new ResizeObserver(updateViewportHeight);
		resizeObserver.observe(viewport);

		return () => {
			resizeObserver.disconnect();
		};
	}, [open]);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setScrollTop(0);
			return;
		}

		if (viewportRef.current) {
			viewportRef.current.scrollTop = 0;
		}
		setScrollTop(0);
	}, [open]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					id={id}
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						"flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
					)}
				>
					<span className="flex min-w-0 items-center gap-2">
						<PresetIconGlyph iconKey={value} className="h-4 w-4 shrink-0 text-muted-foreground" />
						<span className="truncate">{triggerLabel}</span>
					</span>
					<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="min-w-[var(--radix-popper-anchor-width)] w-[var(--radix-popper-anchor-width)] p-0"
			>
				<Command shouldFilter={false}>
					<CommandInput placeholder={searchPlaceholder} value={query} onValueChange={handleQueryChange} />
					<div className="border-b p-1">
						<button
							type="button"
							className="flex h-9 w-full items-center rounded-sm px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
							onClick={() => {
								onChange(null);
								setOpen(false);
							}}
						>
							<CheckIcon className={cn("mr-2 h-4 w-4", activeValue === "__none__" ? "opacity-100" : "opacity-0")} />
							<span>{noneLabel}</span>
						</button>
					</div>
					{filteredIconOptions.length === 0 ? (
						<div className="py-6 text-center text-sm">{noResultsLabel}</div>
					) : (
						<div
							ref={viewportRef}
							className="max-h-[300px] overflow-y-auto overflow-x-hidden"
							role="listbox"
							onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
						>
							<div className="relative" style={{ height: totalRowsHeight }}>
								{visibleRows.map((iconOption, visibleIndex) => {
									const rowIndex = startIndex + visibleIndex;
									return (
										<button
											key={iconOption.key}
											type="button"
											role="option"
											aria-selected={activeValue === iconOption.key}
											className="absolute left-0 right-0 flex h-9 items-center rounded-sm px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
											style={{ top: rowIndex * ROW_HEIGHT }}
											onClick={() => {
												onChange(iconOption.key);
												setOpen(false);
											}}
										>
											<CheckIcon
												className={cn("mr-2 h-4 w-4", activeValue === iconOption.key ? "opacity-100" : "opacity-0")}
											/>
											<PresetIconGlyph iconKey={iconOption.key} className="mr-2 h-4 w-4 text-muted-foreground" />
											<span className="truncate">{iconOption.label}</span>
										</button>
									);
								})}
							</div>
						</div>
					)}
				</Command>
			</PopoverContent>
		</Popover>
	);
};
