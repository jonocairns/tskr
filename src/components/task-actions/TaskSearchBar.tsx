import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useTranslation } from "@/lib/i18nClient";

type TaskSearchBarProps = {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onClear: () => void;
};

export const TaskSearchBar = ({ searchQuery, onSearchChange, onClear }: TaskSearchBarProps) => {
	const { t } = useTranslation();

	return (
		<div className="grid gap-2">
			<div className="flex items-center justify-between gap-2">
				<Label htmlFor="task-search">{t("Search tasks")}</Label>
				<Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={searchQuery.trim().length === 0}>
					{t("Clear")}
				</Button>
			</div>
			<Input
				id="task-search"
				type="search"
				placeholder={t("Filter tasks by name")}
				value={searchQuery}
				onChange={(event) => onSearchChange(event.target.value)}
			/>
		</div>
	);
};
