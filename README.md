# @alnvdl/request

@alnvdl/request is an opinionated library with a fetch API wrapper and React
hook for making HTTP requests automatically or on demand.

It was built with a few goals in mind:
- its use should result in extremely simple component code for basic GET and
  POST requests;
- it should be simple to understand and use by people who just learned React
  hooks, with helpful debugging and error messages;
- no external dependencies apart from the core React hooks;

It also has an important anti-goal: it's not meant to be used for high-traffic,
public-facing production websites. It was originaly built for GET-oriented,
low-traffic websites and intranet tools, where caching and deduplication are
not big concerns. For anything more serious, the React ecosystem is full of
great alternatives like `useQuery` or Next.js.

## Getting started
@alnvdl/request is not available in the public NPM registry, but you can
install it directly from GitHub:
```
npm install github:alnvdl/request#semver:^1.0.0
```

If you prefer an npm registry, you can configure your environment to use the
GitHub Packages[^1] registry and then install the
[@alnvdl/request package](https://github.com/alnvdl/request/pkgs/npm/request).

After installing, import it in your code:
```js
import { request, useRequest } from '@alnvdl/request';
```

[Example code is available](./src/index.tsx). The example code is in
TypeScript to make it more complete, but this library is a pure JS library
with optional TypeScript annotations.

This repository is also a [CRA](https://create-react-app.dev/) project, so you
can run `npm run start` to see a live demo, or `npm run test` to run the tests.

## Reference
This module exports two functions:

### `useRequest`
```js
function useRequest(method, url, {
    headers,
    body,
    parseAs,
    idGenerator,
    adapter,
    lazy
} = {})
```

`useRequest` should be **used as a React hook directly in component code** to
make an HTTP request using the fetch API[^2] with the given `method` and `url`.
The final `opts` argument is an entirely optional object that may contain:

- a `headers` object with custom headers for the request;
- a `body` for the request;
- the `parseAs` string indicating the type of body expected in the response,
  which can be: `"arrayBuffer"`, `"blob"`, `"formData"`, `"json"` or `"text"`.
  If not given, the `Content-Type` header of the response will be used to
  determine it, and if that is not possible, `"text"` will be assumed.
- an `idGenerator` function that returns a new request ID. If not present, a
  default random-string generator will be used.
- an `adapter` function with signature
  `({reqID, status, data, error}) => {status, data, error}`
  This function can be used to override any regular or error condition returned
  in a response, and it's especially useful in case you want to treat certain
  error conditions differently or change state in your component when a
  response is received. For example, if a 404 error is not to be considered a
  problem for a certain endpoint, this function may set `error` to `null`.
- an `lazy` boolean flag that indicates whether the fetch should only run when
  the returned `fetch` function is called. If you need a component to be able
  to make a request on mount and then later make the request on demand, use an
  effect that calls the returned `fetch` function, with a dependency on it (it
  is guaranteed to never change). However, in most cases you should probably
  use `request` instead. See [request vs useRequest](#request-vs-userequest).

Returns an object:
```js
{reqID, status, data, error, loading, fetch, lastFetch}
```
- `reqID` is a request identifier generated when the request was started;
- `status` is the HTTP status code if the request concluded successfully, or
  REQUEST_FAILED (-2) if the request failed unexpectedly with a non-HTTP error,
  REQUEST_PENDING (-1) if the request wasn't made yet or
  REQUEST_ONGOING (0) is in progress;
- `data` is the most recent response data or `null`;
- `error` is a truthy value in case there are errors in making the request or
  in the response, and in case of regular HTTP error status codes, its content
  will be the same as data;
- `loading` indicates whether the request is still under way;
- `fetch` is a function that can be used to trigger a fetch at any time if
  `lazy` is set to true;
- `lastFetch` is the timestamp for the last time the `fetch` function was
  called, or `null` if it was never called.

### `request`
```js
function request(method, url, {
    headers,
    body,
    parseAs,
    idGenerator,
    callback
} = {})
```

`request` **should be used in event handlers** to make an HTTP request using
the fetch API[^2] with the given `method` and `url`.

`headers`, `body`, `parseAs` and `idGenerator` are exactly as described in
`useRequest`. `callback` is a function that will get called with:
```js
{reqID, status, data, error, loading}
```

These values are exactly as documented as the return value of `useRequest`.

A call to `request` returns no values, and instead only the `callback` is
invoked whenever there's an update.

The typical usage pattern is as follows:
```js
let [req, setReq] = useState(requestInitialState());

// And then within the event handler:
    request("POST", "...", {callback: setReq});
```

But this is only a suggestion: a component can freely define how the `callback`
will affect its own internal state.

### request vs. useRequest
**TL;DR**: use `useRequest` directly in component code. Use `request` in event
handlers. If after reviewing the React docs you feel like `useRequest` with
`lazy` is a better approach, use that instead.

Now the long explanation: `request` is an `async` function that wraps the
`fetch` function provided by browsers. It is meant to be used when the hook is
not the best option, such as when making requests after the user takes some
action on the page (for example, in event handlers when a button is clicked to
load some information, or when a form gets submitted).

`useRequest` should be used when the page is loaded, as part of its natural
flow. It is built on top of `useEffect`.

However, `useRequest` provides an escape hatch: the `lazy` flag. It instructs
`useRequest` to not make the request immediately, but rather to wait for a
call to the `fetch` function it returns. The request is then repeated every
time `fetch` is called. Within `useRequest`, `lazy` causes the `useEffect` hook
to have an additional dependency: the timestamp in which a new request was
ordered. Whenever that timestamp changes by calling `fetch` and a request is
not already ongoing, a new request gets initiated.

This means `lazy`+`fetch` can be used to make `useRequest` behave almost
exactly like `request`, but not quite: it may look like it simplifies component
code at first, but it complicates the logic underneath. In general, using
`useEffect` to react to user-initiated events is discouraged (even if
indirectly as in `useRequest`). The reasons for this are discussed extensively
in the React docs[^3].

However, there might be cases when it makes sense to allow for that kind of
control[^4], so `lazy` and `fetch` are provided. For example, it could be used
together with `setInterval` to periodically refresh data displayed to the user.
But use it with moderation: most of the time, you should prefer `request` in
event handlers.

Additionally, as a general guideline, one would usually use `useRequest` for
`GET` requests, and `request` for `POST` and `PUT` requests. But this is not a
hard rule, it will depend a lot on the API and the component.

### Other definitions
A few other consts and functions are exported:

#### `const REQUEST_FAILED = -1`
The value of the `status` field set by `useRequest`/`request` to indicate that
the request failed due to an unexpected error (e.g., a network issue).

#### `const REQUEST_PENDING = 0`
The value of the `status` field set by `useRequest`/`request` to indicate that
a request still needs to be made. This is the initial status, and it indicates
that the request was not started yet.

#### `const REQUEST_ONGOING = 1`
The value of the `status` field set by `useRequest`/`request` to indicate that
a request is in progress.

#### `function requestInitialState()`
Returns the initial bundle state for use with `useState` in components that are
using `request`. To see it in action, check out the `requestDemo` component in
the [example code](./src/index.tsx).

[^1]: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry
[^2]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
[^3]: https://beta.reactjs.org/learn/you-might-not-need-an-effect#sending-a-post-request
[^4]: https://beta.reactjs.org/learn/you-might-not-need-an-effect#fetching-data
