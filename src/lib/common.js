export const REQUEST_FAILED = -2;
export const REQUEST_PENDING = -1;
export const REQUEST_ONGOING = 0;

// readBody reads the body of the given request, optionally taking a hint for
// the type of the body (arrayBuffer, blob, formData, json or text). If the
// parseAs is undefined or unknown, the Content-Type header of the response
// may determine the type of the body. If nothing else works, the body will be
// parsed as text.
export async function readBody(rsp, parseAs) {
    if (!parseAs) {
        parseAs = {
            "application/json": "json",
            "multipart/form-data": "formData",
            "text/plain": "text"
        }[rsp.headers?.get("Content-Type")?.split(";")[0]];
    }
    switch (parseAs) {
        case "arrayBuffer":
            return await rsp.arrayBuffer();
        case "blob":
            return await rsp.blob();
        case "formData":
            return await rsp.formData();
        case "json":
            return await rsp.json();
        default:
            return await rsp.text();
    }
}

// reqMsg returns a function that builds log messages for a request.
export function reqMsg(caller, reqID, method, url) {
    return (m, status) => {
        let reqIDPart = reqID ? ` ${reqID}` : "";
        let statusPart = status ? ` [${status}]` : "";
        return `${caller} request${reqIDPart} [${method} ${url}]: ${m}${statusPart}`;
    }
}

// defaultReqIDGenerator is the default request ID generator used when none is
// provided.
export function defaultIDGenerator() {
    return Math.random().toString(36).slice(2, 8);
}
