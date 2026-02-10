import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/lib/i18nClient";

type TaskSearchBarProps = {
	searchQuery: string;
	onSearchChange: (query: string) => void;
};

export const TaskSearchBar = ({ searchQuery, onSearchChange }: TaskSearchBarProps) => {
	const { t } = useTranslation();
	const searchInputId = "task-search";

	return (
		<Input
			id={searchInputId}
			type="search"
			aria-label={t("Search tasks")}
			placeholder={t("Filter tasks by name")}
			value={searchQuery}
			onChange={(event) => onSearchChange(event.target.value)}
		/>
	);
};
