export type PresetIconKey = string;

const LEGACY_PRESET_ICON_KEY_MAP = {
	clipboard: "ClipboardList",
	clipboardCheck: "ClipboardCheck",
	house: "House",
	calendarClock: "CalendarClock",
	calendarCheck: "CalendarCheck",
	bell: "Bell",
	clock3: "Clock3",
	timer: "Timer",
	hourglass: "Hourglass",
	utensils: "Utensils",
	handPlatter: "HandPlatter",
	cookie: "Cookie",
	milk: "Milk",
	egg: "Egg",
	sandwich: "Sandwich",
	apple: "Apple",
	carrot: "Carrot",
	flame: "Flame",
	snowflake: "Snowflake",
	bath: "Bath",
	droplets: "Droplets",
	waves: "Waves",
	shirt: "Shirt",
	washingMachine: "WashingMachine",
	bedSingle: "BedSingle",
	sofa: "Sofa",
	lamp: "Lamp",
	tv: "Tv",
	music: "Music",
	headphones: "Headphones",
	gamepad2: "Gamepad2",
	baby: "Baby",
	footprints: "Footprints",
	bike: "Bike",
	bus: "Bus",
	pawPrint: "PawPrint",
	fish: "Fish",
	bird: "Bird",
	rabbit: "Rabbit",
	bug: "Bug",
	trash2: "Trash2",
	trash: "Trash",
	recycle: "Recycle",
	sprayCan: "SprayCan",
	shoppingCart: "ShoppingCart",
	circleDollarSign: "CircleDollarSign",
	piggyBank: "PiggyBank",
	gift: "Gift",
	partyPopper: "PartyPopper",
	car: "Car",
	smartphone: "Smartphone",
	tablet: "Tablet",
	bookOpen: "BookOpen",
	briefcase: "Briefcase",
	dumbbell: "Dumbbell",
	leaf: "Leaf",
	trees: "Trees",
	flower2: "Flower2",
	sun: "Sun",
	moon: "Moon",
	cloudRain: "CloudRain",
	cloudSun: "CloudSun",
	toolbox: "Toolbox",
	wrench: "Wrench",
	hammer: "Hammer",
	drill: "Drill",
	paintRoller: "PaintRoller",
	scissors: "Scissors",
	brush: "Brush",
	sparkles: "Sparkles",
} as const;

export const normalizePresetIconKey = (iconKey?: string | null): PresetIconKey | null => {
	if (!iconKey) {
		return null;
	}

	const trimmed = iconKey.trim();
	if (!trimmed) {
		return null;
	}

	return LEGACY_PRESET_ICON_KEY_MAP[trimmed as keyof typeof LEGACY_PRESET_ICON_KEY_MAP] ?? trimmed;
};
