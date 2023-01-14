import {
    REQUEST_FAILED,
    REQUEST_PENDING,
    REQUEST_ONGOING,
    defaultIDGenerator,
    reqMsg,
    readBody
} from './common';

export function requestInitialState() {
    return {
        reqID: null,
        status: REQUEST_PENDING,
        data: null,
        error: null,
        loading: false,
    }
}

// useRequest is an opinionated wrapper around the fetch API that invokes a
// callback and has a signature that is very similar to useRequest. See the
// README.md file for details.
export async function request(method, url, {
    headers,
    body,
    parseAs,
    idGenerator,
    callback
} = {}) {
    let reqID = idGenerator ? idGenerator() : defaultIDGenerator();
    let msg = reqMsg("request", reqID, method, url);
    callback = callback || function() {}
    console.debug(msg("making request"));
    callback({
        reqID: reqID,
        status: REQUEST_ONGOING,
        data: null,
        error: null,
        loading: true,
    });
    try {
        let rsp = await fetch(url, {
            headers,
            method,
            body,
        });
        let data = await readBody(rsp, parseAs);
        console.debug(msg("request concluded, calling callback", rsp.status));
        callback({
            reqID: reqID,
            status: rsp.status,
            data: data,
            error: rsp.ok ? null : (data || true),
            loading: false,
        });
    } catch (err) {
        console.error(msg("error making request or handling response (this is NOT a regular HTTP error response)", err));
        callback({
            reqID: reqID,
            status: REQUEST_FAILED,
            data: err.toString(),
            error: err.toString(),
            loading: false,
        });
    };
}
