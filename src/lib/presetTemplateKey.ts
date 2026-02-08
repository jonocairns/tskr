type ShouldClearTemplateKeyOnPresetUpdateInput = {
	templateKey: string | null;
	currentLabel: string;
	currentBucket: string;
	nextLabel?: string;
	nextBucket?: string;
};

export const shouldClearTemplateKeyOnPresetUpdate = ({
	templateKey,
	currentLabel,
	currentBucket,
	nextLabel,
	nextBucket,
}: ShouldClearTemplateKeyOnPresetUpdateInput) => {
	if (!templateKey) {
		return false;
	}

	const labelChanged = nextLabel !== undefined && nextLabel !== currentLabel;
	const bucketChanged = nextBucket !== undefined && nextBucket !== currentBucket;

	return labelChanged || bucketChanged;
};
