import { commonOpts, idGenerator, requestResult } from "./common";

type requestCallback = (req: requestResult) => void;

type requestOpts = commonOpts & {
    callback?: requestCallback,
};

export function request(
    method: string,
    url: string,
    opts?: requestOpts
): void;

export function requestInitialState(): requestResult
