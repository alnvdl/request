import {useEffect, useCallback, useReducer} from 'react';

import {
    REQUEST_PENDING,
    REQUEST_ONGOING,
    REQUEST_FAILED,
    defaultIDGenerator,
    reqMsg,
    readBody,
} from './common';

function initialState() {
    return {
        reqID: null,
        error: null,
        data: null,
        status: REQUEST_PENDING,
        loading: null,
        fetchTs: null,
        lastFetchTs: null,
    }
}

function setState(state, action) {
    /* istanbul ignore next
    Covering all of the switch branches would require us to call dispatch with
    an incorrect action, which would only happen if we intentionally broke
    useRequest.
    */
    switch (action.type) {
        case "RESET":
            // If we started another request already, nothing to reset.
            if (state.reqID !== action.payload.reqID) {
                return state;
            }
            return initialState();
        case "START_REQUEST":
            return {
                reqID: action.payload.reqID,
                data: state.data,
                error: null,
                status: REQUEST_ONGOING,
                loading: true,
                fetchTs: state.fetchTs,
                lastFetchTs: state.lastFetchTs,
            }
        case "FINISH_REQUEST":
            return {
                reqID: state.reqID,
                data: action.payload.data,
                error: action.payload.error,
                status: action.payload.status,
                loading: false,
                fetchTs: null,
                lastFetchTs: state.fetchTs,
            }
        case "REQUEST_AGAIN":
            if (state.status === REQUEST_ONGOING) {
                return state;
            }
            return {
                reqID: state.reqID,
                data: state.data,
                error: state.error,
                status: state.status,
                loading: state.loading,
                fetchTs: Date.now(),
                lastFetchTs: state.lastFetchTs,
            }
        default:
    }
}

// useRequest is an opinionated React hook for making HTTP requests
// automatically or on demand. See the README.md file for details.
export function useRequest(method, url, {
    headers,
    body,
    adapter,
    parseAs,
    lazy,
    idGenerator
} = {}) {
    const [state, dispatch] = useReducer(setState, initialState());

    let fetchFn = useCallback(() => {
        dispatch({type: "REQUEST_AGAIN"});
    }, []);

    let invalidFetchFn = useCallback(() => {
        console.error("invalid call to useRequest().fetch: lazy must be set to true");
    }, []);

    lazy = lazy || false;
    adapter = adapter || (rsp => rsp);

    useEffect(() => {
        let canceled = false;
        let beforeMsg = reqMsg("useRequest", undefined, method, url);
        // If we should only fetch on demand, and no request was made to fetch,
        // then do nothing. If a request is in progress, don't do anything.
        if (lazy && state.fetchTs === null) {
            console.debug(beforeMsg("waiting to make request because it's lazy and fetch needs to be called"));
            return;
        }
        if (lazy && state.status === REQUEST_ONGOING) {
            console.debug(beforeMsg("skipping request because it's lazy and another request is still in progress"));
            return;
        }

        let reqID = idGenerator ? idGenerator() : defaultIDGenerator();
        let msg = reqMsg("useRequest", reqID, method, url);
        let makeRequest = async () => {
            try {
                console.debug(msg("making request"));
                let rsp = await fetch(url, {
                    headers,
                    method,
                    body,
                });
                if (canceled) {
                    console.debug(msg("ignoring response for canceled request before reading response body", rsp.status));
                    dispatch({type: "RESET", payload: {reqID}});
                    return;
                };

                let data = await readBody(rsp, parseAs);
                if (canceled) {
                    console.debug(msg("ignoring response for canceled request after reading response body", rsp.status));
                    dispatch({type: "RESET", payload: {reqID}});
                    return;
                };
                console.debug(msg("request concluded, updating state", rsp.status));
                dispatch({
                    type: "FINISH_REQUEST",
                    payload: adapter({
                        reqID: reqID,
                        status: rsp.status,
                        data: data,
                        error: rsp.ok ? null : (data || true),
                    })
                });
            } catch (err) {
                if (canceled) {
                    console.debug(msg("ignoring response for canceled request", err.toString));
                    dispatch({type: "RESET", payload: {reqID}});
                    return;
                };
                console.error(msg("error making request or handling response (this is NOT a regular HTTP error response)", err));
                dispatch({
                    type: "FINISH_REQUEST",
                    payload: adapter({
                        reqID: reqID,
                        status: REQUEST_FAILED,
                        data: err.toString(),
                        error: err.toString(),
                    })
                });
            }
        }
        makeRequest();
        dispatch({type: "START_REQUEST", payload: {reqID}});

        return () => {
            // This is the useEffect cleanup function. React calls it due to
            // unmounts or re-renders. If this is causing problems, the
            // solution is usually to invoke fetch again or rethink your
            // component's logic so that requests are not wasted due to
            // re-renders.
            console.debug(msg("useRequest cleanup function was executed, any pending response will be ignored"));
            canceled = true;
        }
        //
        // eslint-disable-next-line
    }, [method, url, body, lazy, state.fetchTs]);
    // TODO(alnvdl): useEffect will not retrigger in case headers or parseAs
    // change. This needs to be fixed.

    return {
        reqID: state.reqID,
        status: state.status,
        data: state.data,
        error: state.error,
        loading: state.loading,
        fetch: lazy ? fetchFn : invalidFetchFn,
        lastFetch: state.lastFetchTs,
    }
}
