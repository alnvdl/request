import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as request from './lib/index';

let rootElement = document.getElementById('root');
if (rootElement != null) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<Demos />);
}

function Demos() {
    return <>
        <h1>request: event handler demo</h1>
        <RequestDemo />
        <hr />
        <h1>useRequest: auto-fetch demo</h1>
        <UseRequestDemoAuto />
        <hr />
        <h1>useRequest: lazy-fetch demo</h1>
        <UseRequestDemolazy />
    </>;
}

// requestDemo makes a request when a button is clicked, using the
// request function.
function RequestDemo() {
    let [zen, setZen] = useState(request.requestInitialState());
    let indicator = indicatorFn(zen);
    if (indicator) {
        return indicator;
    }

    return <>
        <input type="button" onClick={() => {
            request.request("GET", "https://api.github.com/zen", {
                callback: setZen
            });
        }} value="Make request" /><br />
        <pre>
            <code>{prettyOutput(zen)}</code>
        </pre>
    </>;
}

// useRequestDemoAuto makes a request as soon as the component is mounted using
// the useRequest hook.
function UseRequestDemoAuto() {
    let zen = useCustomRequest("GET", "https://api.github.com/zen");
    if (zen.indicator) {
        return zen.indicator;
    }

    return <pre>
        <code>{prettyOutput(zen)}</code>
    </pre>;
}

// useRequestDemoAuto makes a request as soon when a button is clicked, using
// the useRequest hook.
function UseRequestDemolazy() {
    let zen = useCustomRequest("GET", "https://api.github.com/zen", { lazy: true });
    if (zen.indicator) {
        return zen.indicator;
    }

    return <>
        <input type="button" onClick={zen.fetch} value="Make request" /><br />
        <pre>
            <code>{prettyOutput(zen)}</code>
        </pre>
    </>;
}


// Loading is a component to be displayed when a request is still in progress.
function Loading() {
    return <div>Loading...</div>;
}

// Error is component to be displayed if a request fails, either with a non-2xx
// response code or with an unexpected failure.
function Error({ message }) {
    return <div style={{ borderLeft: "3px solid red", paddingLeft: "8px" }}>
        <strong>Error:</strong>&nbsp;<code>{message}</code>
    </div>;
}

// indicatorFn returns the Loading component if the request is loading or
// pending, the error component if an error happened, or null if neither
// condition is true.
function indicatorFn({status, loading, error}, pendingIsLoading?: boolean) {
    if (loading || (pendingIsLoading && status === request.REQUEST_PENDING)) {
        return <Loading />;
    }
    if (error) {
        return <Error message={JSON.stringify(error)} />;
    }
    return null;
};

// useCustomrequest wraps useRequest with certain adaptations. In this case,
// it will set an indicator for easier rendering of loading and error states.
// It could also set extra headers, or change the request body.
// This is the expected pattern when customizing `useRequest` so that it can
// have custom and uniform behavior for an entire application.
// The same kind of wrapper can be written for the regular request function.
function useCustomRequest(method: string, url: string, opts?: request.useRequestOpts): (request.useRequestReturn & {indicator: any}) {
    let rsp = request.useRequest(method, url, opts);
    return {...rsp, indicator: indicatorFn(rsp, !opts?.lazy)}
}

// stringifyuseRequest is a function that helps us show the value returned
// by useRequest.
function prettyOutput(v: request.useRequestReturn | any): string {
    return JSON.stringify({
        reqID: v.reqID,
        status: v.status,
        data: v.data,
        error: v.error,
        loading: v.loading,
        fetch: v.fetch,
        lastFetch: v.lastFetch,
    }, null, 4);
}
