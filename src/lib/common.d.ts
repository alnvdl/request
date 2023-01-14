export const REQUEST_FAILED = -1;
export const REQUEST_PENDING = 0;
export const REQUEST_ONGOING = 1;

type requestResult = {
    reqID: string | null,
    status: number,
    data: any | null,
    error: any | null,
    loading: boolean
};

type commonOpts = {
    headers?: Headers,
    body?: any,
    parseAs?: "arrayBuffer" | "blob" | "formData" | "json" | "text",
    idGenerator?: idGenerator,
};

type idGenerator = () => string;
