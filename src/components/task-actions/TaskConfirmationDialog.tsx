import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/AlertDialog";

type TaskConfirmationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	onCancel: () => void;
};

export const TaskConfirmationDialog = ({ open, onOpenChange, onConfirm, onCancel }: TaskConfirmationDialogProps) => {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Log this task again?</AlertDialogTitle>
					<AlertDialogDescription>
						You just logged this task. Are you sure you want to log it again?
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Yes, log it again</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
