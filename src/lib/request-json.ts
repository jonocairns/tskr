type JsonRequestInit = Omit<RequestInit, "body" | "headers"> & {
	body?: unknown;
	headers?: HeadersInit;
};

const readJson = async <T>(res: Response): Promise<T> => {
	try {
		return (await res.json()) as T;
	} catch {
		return {} as T;
	}
};

export const requestJson = async <T>(
	input: RequestInfo | URL,
	{ body, headers, ...init }: JsonRequestInit = {},
) => {
	const hasBody = body !== undefined;
	const res = await fetch(input, {
		...init,
		headers: hasBody
			? { "Content-Type": "application/json", ...headers }
			: headers,
		body: hasBody ? JSON.stringify(body) : undefined,
	});

	const data = await readJson<T>(res);
	return { res, data };
};
