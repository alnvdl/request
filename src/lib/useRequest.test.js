import {renderHook, act, waitFor} from '@testing-library/react';
import {useRequest} from './useRequest';
import {REQUEST_FAILED, REQUEST_PENDING, REQUEST_ONGOING} from './common';

function contentTypeHeaders(contentType) {
    let h = new Headers();
    h.set("Content-Type", contentType);
    return h;
}

function serialReqIDGenerator() {
    var reqID = 0;
    return () => {
        reqID++;
        return "" + reqID;
    }
}

test("makes the request automatically", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                json: () => Promise.resolve({"test": 123}),
                headers: contentTypeHeaders("application/json"),
            });
        });
    });
    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001"));
    await waitFor(() => expect(result.current).toEqual({
        reqID: expect.any(String),
        data: {"test": 123},
        error: null,
        status: 200,
        loading: false,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    global.fetch.mockClear();
});

test("handles error responses", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 404,
                ok: false,
                formData: () => Promise.resolve("not found"),
            });
        });
    });
    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001", {
        parseAs: "formData",
    }));
    await waitFor(() => expect(result.current).toEqual({
        reqID: expect.any(String),
        data: "not found",
        error: "not found",
        status: 404,
        loading: false,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    global.fetch.mockClear();
});

test("handles error responses correctly even if response body is absent/falsy", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 401,
                ok: false,
                text: () => Promise.resolve(""),
            });
        });
    });
    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001"));
    await waitFor(() => expect(result.current).toEqual({
        reqID: expect.any(String),
        data: "",
        error: true,
        status: 401,
        loading: false,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    global.fetch.mockClear();
});

test("handles request cancellation after reading the body", async () => {
    let resolveBodies = [];
    let fetch = jest.fn(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                blob: () => new Promise(resolve => {
                    resolveBodies.push(resolve);
                }),
                headers: contentTypeHeaders("text/plain"),
            });
        });
    });
    let reqIDGen = serialReqIDGenerator();
    jest.spyOn(global, "fetch").mockImplementation(fetch);
    const {result, rerender} = renderHook(({method, url}) => useRequest(method, url, {
        parseAs: "blob",
        idGenerator: reqIDGen
    }), {
        initialProps: {method: "GET", url: "http://localhost:3001"}
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    // Call with another URL to trigger another request and cancel the pending
    // one.
    await act(async () => {
        rerender({method: "GET", url: "http://localhost:3001/dev"}, {
            parseAs: "blob"
        });
    });
    // Make the first request finish. It should have no effects, because the
    // hook has moved on.
    await act(async () => {
        resolveBodies[0]("rsp1");
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "2",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    // Return value should be that of the new request after it's finished.
    await act(async () => {
        resolveBodies[1]("rsp2");
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "2",
        data: "rsp2",
        error: null,
        status: 200,
        loading: false,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    global.fetch.mockClear();
});

test("handles request cancellation if there was an error reading the requset", async () => {
    let resolveBodies = [];
    let rejectBodies = [];
    let fetch = jest.fn(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                text: () => new Promise((resolve, reject) => {
                    resolveBodies.push(resolve);
                    rejectBodies.push(reject);
                }),
                headers: contentTypeHeaders("text/plain"),
            });
        });
    });
    let reqIDGen = serialReqIDGenerator();
    jest.spyOn(global, "fetch").mockImplementation(fetch);
    const {result, rerender} = renderHook(({method, url}) => useRequest(method, url, {
        idGenerator: reqIDGen
    }), {
        initialProps: {method: "GET", url: "http://localhost:3001"}
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    // Call with another URL to trigger another request and cancel the pending
    // one.
    await act(async () => {
        rerender({method: "GET", url: "http://localhost:3001/dev"});
    });
    // Make the first request finish with an error. It should have no effects,
    // because the hook has moved on.
    await act(async () => {
        rejectBodies[0]("error in request 1");
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "2",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    // Return value should be that of the new request after it's finished.
    await act(async () => {
        resolveBodies[1]("rsp2");
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "2",
        data: "rsp2",
        error: null,
        status: 200,
        loading: false,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    global.fetch.mockClear();
});

test("handles unexpected errors (non-HTTP errors)", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                text: () => Promise.reject(new Error("unexpected error reading the body")),
            });
        });
    });
    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001"));
    await waitFor(() => expect(result.current).toEqual({
        reqID: expect.any(String),
        data: "Error: unexpected error reading the body",
        error: "Error: unexpected error reading the body",
        status: REQUEST_FAILED,
        loading: false,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    global.fetch.mockClear();
});

test("lazy: returns initial state when fetch hasn't been called yet", () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                json: () => Promise.resolve({"test": 123}),
                headers: contentTypeHeaders("application/json"),
            });
        });
    });
    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001", {
        lazy: true
    }));
    expect(result.current).toEqual({
        reqID: null,
        data: null,
        error: null,
        status: REQUEST_PENDING,
        loading: null,
        lastFetch: null,
        fetch: expect.anything(),
    });
    global.fetch.mockClear();
});

test("lazy: calls to fetch are ignored if lazy is false", () => {
    consoleErrorFn = jest.fn()
    jest.spyOn(global.console, "error").mockImplementation(consoleErrorFn);
    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001"));
    result.current.fetch();
    expect(consoleErrorFn).toHaveBeenCalledWith("invalid call to useRequest().fetch: lazy must be set to true");
    global.fetch.mockClear();
});


test("lazy: makes multiple requests if fetch is called multiple times", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                json: () => Promise.resolve({"test": 123}),
                headers: contentTypeHeaders("application/json"),
            });
        });
    });
    let reqIDGen = serialReqIDGenerator();

    const {result} = renderHook(() => useRequest("GET", "http://localhost:3001", {
        lazy: true,
        idGenerator: reqIDGen
    }));
    act(() => {
        result.current.fetch();
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: {"test": 123},
        error: null,
        status: 200,
        loading: false,
        lastFetch: expect.any(Number),
        fetch: expect.anything(),
    }));

    act(() => {
        result.current.fetch();
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "2",
        data: {"test": 123},
        error: null,
        status: 200,
        loading: false,
        lastFetch: expect.any(Number),
        fetch: expect.anything(),
    }));

    global.fetch.mockClear();
});

test("lazy: calls to fetch are ignored if a request is already ongoing", async () => {
    let resolveBodies = [];
    let fetch = jest.fn(() => {
        return new Promise((resolve) => {
            resolve({
                status: 200,
                ok: true,
                arrayBuffer: () => new Promise(resolve => {
                    resolveBodies.push(resolve);
                }),
            });
        });
    });
    let reqIDGen = serialReqIDGenerator();
    jest.spyOn(global, "fetch").mockImplementation(fetch);
    const {result, rerender} = renderHook(({method, url}) => useRequest(method, url, {
        idGenerator: reqIDGen,
        lazy: true,
        parseAs: "arrayBuffer"
    }), {
        initialProps: {method: "GET", url: "http://localhost:3001"}
    });

    await act(async () => {
        result.current.fetch();
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));

    await act(async () => {
        result.current.fetch();
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));

    await act(async () => {
        resolveBodies[0]("rsp1");
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: "rsp1",
        error: null,
        status: 200,
        loading: false,
        lastFetch: expect.any(Number),
        fetch: expect.anything(),
    }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    global.fetch.mockClear();
});

test("lazy: handles request cancellation", async () => {
    let resolveRequests = [];
    let fetch = jest.fn(() => {
        return new Promise((resolve) => {
            resolveRequests.push(resolve);
        });
    });
    let reqIDGen = serialReqIDGenerator();
    jest.spyOn(global, "fetch").mockImplementation(fetch);
    const {result, rerender} = renderHook(({method, url}) => useRequest(method, url, {
        idGenerator: reqIDGen,
        lazy: true
    }), {
        initialProps: {method: "GET", url: "http://localhost:3001"}
    });
    await act(async () => {
        result.current.fetch();
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual({
        reqID: "1",
        data: null,
        error: null,
        status: REQUEST_ONGOING,
        loading: true,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    // Call with another URL to cause the old one to be cancelled.
    await act(async () => {
        rerender({method: "GET", url: "http://localhost:3001/dev"});
    });
    // Make the first request finish. It should have no effects, because the
    // hook has moved on to another request.
    await act(async () => {
        resolveRequests[0]({
            status: 200,
            ok: true,
            text: () => new Promise(resolve => {
                resolve("ignored response");
            }),
            headers: contentTypeHeaders("text/plain"),
        });
    });
    // The other request wasn't really made because the change happened while
    // the previous request was still in progress.
    await waitFor(() => expect(result.current).toEqual({
        reqID: null,
        data: null,
        error: null,
        status: REQUEST_PENDING,
        loading: null,
        lastFetch: null,
        fetch: expect.anything(),
    }));
    // Calling fetch again should make the new request happen.
    await act(async () => {
        result.current.fetch();
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => {
        resolveRequests[1]({
            status: 200,
            ok: true,
            text: () => new Promise(resolve => {
                resolve("actual response");
            }),
            headers: contentTypeHeaders("text/plain"),
        });
    });
    await waitFor(() => expect(result.current).toEqual({
        reqID: "2",
        data: "actual response",
        error: null,
        status: 200,
        loading: false,
        lastFetch: expect.any(Number),
        fetch: expect.anything(),
    }));
    global.fetch.mockClear();
});

// TODO(alnvdl): add tests using adapter.
