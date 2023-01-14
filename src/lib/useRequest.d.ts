import { commonOpts, requestResult, idGenerator } from "./common";

type useRequestadapterParams = {
    reqID: string,
    data: any,
    error: any,
    status: number
};

type useRequestadapter = (req: useRequestadapterParams) => useRequestadapterParams;

type useRequestReturn = requestResult & {
    fetch: () => {},
    lastFetch: number,
};

type useRequestOpts = commonOpts & {
    adapter?: useRequestadapter,
    lazy?: boolean,
};

export function useRequest(
    method: string,
    url: string,
    opts?: useRequestOpts
): useRequestReturn;
