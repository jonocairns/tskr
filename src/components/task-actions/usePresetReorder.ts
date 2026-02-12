import {
	type DragEndEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PresetSummary } from "@/components/task-actions/types";

type UsePresetReorderInput = {
	sortedEditablePresets: PresetSummary[];
	canReorderPresets: boolean;
	onReorderPresets?: (orderedPresetIds: string[]) => Promise<boolean>;
};

export const usePresetReorder = ({
	sortedEditablePresets,
	canReorderPresets,
	onReorderPresets,
}: UsePresetReorderInput) => {
	const [dragOrderedPresetIds, setDragOrderedPresetIds] = useState<string[]>(() => {
		return sortedEditablePresets.map((preset) => preset.id);
	});
	const [activeDragPresetId, setActiveDragPresetId] = useState<string | null>(null);
	const dragStartOrderRef = useRef<string[]>([]);
	const isLocalReorderPendingRef = useRef(false);

	const sortedEditablePresetIds = useMemo(() => {
		return sortedEditablePresets.map((preset) => preset.id);
	}, [sortedEditablePresets]);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	useEffect(() => {
		if (activeDragPresetId !== null) {
			return;
		}

		setDragOrderedPresetIds((previousIds) => {
			const isSameOrder =
				previousIds.length === sortedEditablePresetIds.length &&
				previousIds.every((presetId, index) => presetId === sortedEditablePresetIds[index]);
			if (isLocalReorderPendingRef.current) {
				if (isSameOrder) {
					isLocalReorderPendingRef.current = false;
				}
				return previousIds;
			}
			return isSameOrder ? previousIds : sortedEditablePresetIds;
		});
	}, [activeDragPresetId, sortedEditablePresetIds]);

	const handleReorderDragStart = (event: DragStartEvent) => {
		if (!canReorderPresets || isLocalReorderPendingRef.current) {
			return;
		}

		dragStartOrderRef.current = dragOrderedPresetIds;
		setActiveDragPresetId(String(event.active.id));
	};

	const handleReorderDragCancel = () => {
		isLocalReorderPendingRef.current = false;
		setActiveDragPresetId(null);
		setDragOrderedPresetIds(dragStartOrderRef.current);
	};

	const handleReorderDragEnd = (event: DragEndEvent) => {
		setActiveDragPresetId(null);

		if (!canReorderPresets || !onReorderPresets) {
			isLocalReorderPendingRef.current = false;
			return;
		}
		if (isLocalReorderPendingRef.current) {
			return;
		}

		if (!event.over) {
			isLocalReorderPendingRef.current = false;
			setDragOrderedPresetIds(dragStartOrderRef.current);
			return;
		}

		const activeId = String(event.active.id);
		const overId = String(event.over.id);
		if (activeId === overId) {
			isLocalReorderPendingRef.current = false;
			return;
		}

		const fromIndex = dragOrderedPresetIds.indexOf(activeId);
		const toIndex = dragOrderedPresetIds.indexOf(overId);
		if (fromIndex < 0 || toIndex < 0) {
			isLocalReorderPendingRef.current = false;
			return;
		}

		const previousOrderIds = dragStartOrderRef.current;
		const nextIds = arrayMove(dragOrderedPresetIds, fromIndex, toIndex);
		setDragOrderedPresetIds(nextIds);

		const hasOrderChanged = dragStartOrderRef.current.some((presetId, index) => presetId !== nextIds[index]);
		if (!hasOrderChanged) {
			isLocalReorderPendingRef.current = false;
			return;
		}

		isLocalReorderPendingRef.current = true;
		const rollback = () => {
			isLocalReorderPendingRef.current = false;
			setDragOrderedPresetIds(previousOrderIds);
		};

		void onReorderPresets(nextIds)
			.then((success) => {
				if (success) {
					return;
				}

				rollback();
			})
			.catch(() => {
				rollback();
			});
	};

	return {
		sensors,
		dragOrderedPresetIds,
		activeDragPresetId,
		handleReorderDragStart,
		handleReorderDragCancel,
		handleReorderDragEnd,
	};
};
