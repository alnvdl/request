import {waitFor} from '@testing-library/react';
import {request, requestInitialState} from './request';
import {REQUEST_FAILED, REQUEST_PENDING, REQUEST_ONGOING} from './common';

function contentTypeHeaders(contentType) {
    let h = new Headers();
    h.set("Content-Type", contentType);
    return h;
}

test("makes the request", async () => {
    let resolveRequest = null;
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolveRequest = () => resolve({
                status: 200,
                ok: true,
                json: () => Promise.resolve({"test": 123}),
                headers: contentTypeHeaders("application/json"),
            });
        });
    });
    let result;
    request("GET", "http://localhost:3001", {callback: req => result = req});
    await waitFor(() => expect(result).toEqual({
        reqID: expect.any(String),
        status: REQUEST_ONGOING,
        data: null,
        error: null,
        loading: true,
    }));
    resolveRequest();
    await waitFor(() => expect(result).toEqual({
        reqID: expect.any(String),
        status: 200,
        data: {"test": 123},
        error: null,
        loading: false,
    }));
    global.fetch.mockClear();
});

test("makes the request even without a callback", async () => {
    let resolveRequest = null;
    let bodyRead = false;
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolveRequest = () => resolve({
                status: 200,
                ok: true,
                json: () => {
                    bodyRead = true;
                    Promise.resolve({"test": 123})
                },
                headers: contentTypeHeaders("application/json"),
            });
        });
    });
    request("GET", "http://localhost:3001");
    resolveRequest();
    await waitFor(() => expect(bodyRead).toBeTruthy());
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
    let result;
    request("GET", "http://localhost:3001", {
        parseAs: "formData",
        idGenerator: () => "1",
        callback: req => result = req,
    });
    await waitFor(() => expect(result).toEqual({
        reqID: "1",
        data: "not found",
        error: "not found",
        status: 404,
        loading: false,
    }));
    global.fetch.mockClear();
});

test("handles error responses correctly even if response body is absent/falsy", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() => {
        return new Promise((resolve) => {
            resolve({
                status: 500,
                ok: false,
                text: () => Promise.resolve(""),
            });
        });
    });
    let result;
    request("GET", "http://localhost:3001", {
        callback: req => result = req,
    });
    await waitFor(() => expect(result).toEqual({
        reqID: expect.any(String),
        data: "",
        error: true,
        status: 500,
        loading: false,
    }));
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
    let result;
    request("GET", "http://localhost:3001", {callback: req => result = req});
    await waitFor(() => expect(result).toEqual({
        reqID: expect.any(String),
        data: "Error: unexpected error reading the body",
        error: "Error: unexpected error reading the body",
        status: REQUEST_FAILED,
        loading: false,
    }));
    global.fetch.mockClear();
});

test("returns correct initial state", async () => {
    expect(requestInitialState()).toEqual({
        reqID: null,
        data: null,
        error: null,
        status: REQUEST_PENDING,
        loading: false,
    });
});

