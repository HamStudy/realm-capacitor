import { User } from "./User";
import { AuthError } from "../../errors";
import { print_error, node_require } from "../../utils";
import urlParse from 'url-parse';
import NodeFetchType, {Response as FetchResponse} from 'node-fetch';
import { Credentials } from "./Credentials";

export const refreshTimers: {[identity: string]: {[path: string]: ReturnType<typeof setTimeout>}} = {};
const retryInterval = 5 * 1000; // Amount of time between retrying authentication requests, if the first request failed.
const refreshBuffer = 20 * 1000; // A "safe" amount of time before a token expires that allow us to refresh it.
const refreshLowerBound = 10 * 1000; // Lower bound for refreshing tokens.

function append_url(server: string, path: string) {
    return server + (server.charAt(server.length - 1) != '/' ? '/' : '') + path;
}

export function normalizeSyncUrl(authUrl: string, syncUrl: string) {
    const parsedAuthUrl = new URL(authUrl);
    const realmProtocol = (parsedAuthUrl.protocol === "https:") ? "realms" : "realm";
    // Inherit ports from the Auth url
    const port = parsedAuthUrl.port ? `:${parsedAuthUrl.port}` : "";
    const baseUrl = `${realmProtocol}://${parsedAuthUrl.hostname}${port}`;
    if (!syncUrl) {
        syncUrl = "/default";
    }
    return new urlParse(syncUrl, baseUrl, false).toString();
}


export function scheduleAccessTokenRefresh(user: User, localRealmPath: string, realmUrl: string, expirationDate: Date) {
    let userTimers = refreshTimers[user.identity];
    if (!userTimers) {
        refreshTimers[user.identity] = userTimers = {};
    }

    // We assume that access tokens have ~ the same expiration time, so if someone already
    // scheduled a refresh, it's likely to complete before the one we would have scheduled
    if (!userTimers[localRealmPath]) {
        const timeout = Math.max(expirationDate.getTime() - Date.now() - refreshBuffer, refreshLowerBound);
        userTimers[localRealmPath] = setTimeout(() => {
            delete userTimers[localRealmPath];
            refreshAccessToken(user, localRealmPath, realmUrl);
        }, timeout);
    }
}

export function validateRefresh(user: User, localRealmPath: string, response: FetchResponse, json: any) {
    let session = (<any>user)._sessionForOnDiskPath(localRealmPath);
    if (!session) {
        return;
    }

    const errorHandler = session.config.error;
    if (response.status != 200) {
        let error = new AuthError(json);
        if (errorHandler) {
            errorHandler(session, error);
        } else {
            print_error(`Unhandled session token refresh error for user ${user.identity} at path ${localRealmPath}`, error);
        }
        return;
    }
    if (session.state === 'invalid') {
        return;
    }
    return session;
}

export function refreshAdminToken(user: User, localRealmPath: string, realmUrl: string) {
    const token = user.token;
    const server = user.server;

    // We don't need to actually refresh the token, but we need to let ROS know
    // we're accessing the file and get the sync label for multiplexing
    let parsedRealmUrl = urlParse(realmUrl);
    const url = append_url(user.server, `realms/files/${encodeURIComponent(parsedRealmUrl.pathname)}`);
    performFetch(url, { method: 'GET', timeout: 10000.0, headers: { Authorization: user.token }})
      .then((response) => {
        // There may not be a Realm Directory Service running on the server
        // we're talking to. If we're talking directly to the sync service
        // we'll get a 404, and if we're running inside ROS we'll get a 503 if
        // the directory service hasn't started yet (perhaps because we got
        // called due to the directory service itself opening some Realms).
        //
        // In both of these cases we can just pretend we got a valid response.
        if (response.status === 404 || response.status === 503) {
            return Promise.resolve({response: <FetchResponse>{status: 200}, json: {path: parsedRealmUrl.pathname, syncLabel: '_direct'}});
        }
        else {
            return response.json().then((json: any) => ({ response, json }));
        }
    })
      .then((responseAndJson) => {
        const response = responseAndJson.response;
        const json = responseAndJson.json;

        const credentials = Credentials.adminToken(token);
        const newUser = user.constructor.login(server, credentials);
        const session = validateRefresh(newUser, localRealmPath, response, json);
        if (session) {
            parsedRealmUrl.set('pathname', json.path);
            session._refreshAccessToken(user.token, parsedRealmUrl.href, json.syncLabel);
        }
    })
    .catch((e: Error) => {
        setTimeout(() => refreshAccessToken(user, localRealmPath, realmUrl), retryInterval);
    });
}

export function refreshAccessToken(user: User, localRealmPath: string, realmUrl: string) {
    if (!(<any>user)._sessionForOnDiskPath(localRealmPath)) {
        // We're trying to refresh the token for a session that's closed. This could happen, for example,
        // when the server is not reachable and we periodically try to refresh the token, but the user has
        // already closed the Realm file.
        return;
    }

    if (!user.server) {
        throw new Error("Server for user must be specified");
    }

    const parsedRealmUrl = urlParse(realmUrl);
    const path = parsedRealmUrl.pathname;
    if (!path) {
        throw new Error(`Unexpected Realm path inferred from url '${realmUrl}'. The path section of the url should be a non-empty string.`);
    }

    if (user.isAdminToken) {
        return refreshAdminToken(user, localRealmPath, realmUrl);
    }

    const url = append_url(user.server, 'auth');
    const options = {
        method: 'POST',
        body: {
            data: user.token,
            path,
            provider: 'realm',
            app_id: ''
        },
        // FIXME: This timeout appears to be necessary in order for some requests to be sent at all.
        // See https://github.com/realm/realm-js-private/issues/338 for details.
        timeout: 10000.0
    };
    const server = user.server;
    const identity = user.identity;
    performFetch(url, options)
        .then((response) => response.json().then((json) => { return { response, json }; }))
        .then((responseAndJson) => {
            const response = responseAndJson.response;
            const json = responseAndJson.json;
            // Look up a fresh instance of the user.
            // We do this because in React Native Remote Debugging
            // `Realm.clearTestState()` will have invalidated the user object
            let newUser = user.constructor._getExistingUser(server, identity);
            if (!newUser) {
                return;
            }

            const session = validateRefresh(newUser, localRealmPath, response, json);
            if (!session) {
                return;
            }

            const tokenData = json.access_token.token_data;
            let syncWorkerPathPrefix = undefined;

            // returned by Cloud instance where sync workers are exposed with ingress and not sync proxy
            if (json.sync_worker) {
                syncWorkerPathPrefix = json.sync_worker.path;
            }

            parsedRealmUrl.set('pathname', tokenData.path);
            session._refreshAccessToken(json.access_token.token, parsedRealmUrl.href, tokenData.sync_label, syncWorkerPathPrefix);

            const errorHandler = session.config.error;
            if (errorHandler && errorHandler._notifyOnAccessTokenRefreshed) {
                errorHandler(session, errorHandler._notifyOnAccessTokenRefreshed)
            }

            const tokenExpirationDate = new Date(tokenData.expires * 1000);
            scheduleAccessTokenRefresh(newUser, localRealmPath, realmUrl, tokenExpirationDate);
        })
        .catch((e) => {
            // in case something lower in the HTTP stack breaks, try again in `retryInterval` seconds
            setTimeout(() => refreshAccessToken(user, localRealmPath, realmUrl), retryInterval);
        })
}

/**
 * The base authentication method. It fires a JSON POST to the server parameter plus the auth url
 * For example, if the server parameter is `http://myapp.com`, this url will post to `http://myapp.com/auth`
 * @param {object} userConstructor
 * @param {string} server the http or https server url
 * @param {object} json the json to post to the auth endpoint
 * @param {Function} callback an optional callback with an error and user parameter
 * @returns {Promise} only returns a promise if the callback parameter was omitted
 */
export function _authenticate(userConstructor: typeof User, server: string, json: any, retries: number) : Promise<any> {
    json.app_id = '';
    const url = append_url(server, 'auth');
    const options = {
        method: 'POST',
        body: json,
        timeout: 5000
    };

    return performFetch(url, options).then((response) => {
        const contentType = response.headers.get('Content-Type');
        if (contentType.indexOf('application/json') === -1) {
            return response.text().then((body) => {
                throw new AuthError({
                    title: `Could not authenticate: Realm Object Server didn't respond with valid JSON`,
                    body,
                });
            });
        } else if (!response.ok) {
            return response.json().then((body) => Promise.reject(new AuthError(body)));
        } else {
            return response.json().then((body) => {
                // TODO: validate JSON
                const token = body.refresh_token.token;
                const identity = body.refresh_token.token_data.identity;
                const isAdmin = body.refresh_token.token_data.is_admin;
                return userConstructor.createUser(server, identity, token, false, isAdmin);
            });
        }
    }, (err) => {
        if (retries < 3) {
            // Retry on network errors (which are different from the auth endpoint returning an error)
            return _authenticate(userConstructor, server, json, retries + 1);
        } else {
            throw err;
        }
    });
}

export function _updateAccount(userConstructor: typeof User, server: string, json: any) : Promise<any> {
    const url = append_url(server, 'auth/password/updateAccount');
    const options = {
        method: 'POST',
        body: json,
    };

    return performFetch(url, options)
        .then((response) => {
            const contentType = response.headers.get('Content-Type');
            if (contentType.indexOf('application/json') === -1) {
                return response.text().then((body) => {
                    throw new AuthError({
                        title: `Could not update user account: Realm Object Server didn't respond with valid JSON`,
                        body,
                    });
                });
            }
            if (!response.ok) {
                return response.json().then((body) => Promise.reject(new AuthError(body)));
            }
            return;
        });
}

// node-fetch supports setting a timeout as a nonstandard extension, but normal fetch doesn't
export function fetchWithTimeout(input: RequestInfo, init?: RequestInit & {timeout?: number}) {
    const request = new Request(input, init);
    const xhr = new XMLHttpRequest();
    xhr.timeout = init.timeout || 0;

    return new Promise<Response>(function(resolve, reject) {
        xhr.onload = () => {
            const options = {
                status: xhr.status,
                statusText: xhr.statusText,
                url: xhr.responseURL,
                headers: (<any>xhr).responseHeaders
            };
            if (!options.headers) {
                options.headers = {'content-type': xhr.getResponseHeader('content-type')};
            }
            const body = 'response' in xhr ? xhr.response : (<any>xhr).responseText;
            resolve(new Response(body, options));
        };
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.ontimeout = () => reject(new TypeError('Network request failed'));
        xhr.open(request.method, request.url, true);
        request.headers.forEach((value, name) => xhr.setRequestHeader(name, value));
        xhr.send(typeof (<any>request)._bodyInit === 'undefined' ? init.body : (<any>request)._bodyInit);
    });
}

export type ResolveFn<T> = (value: T | PromiseLike<T>) => void;
export type RejectFn = (reason: any) => void; 
export interface FetchOptions { // slightly modified from RequestInit
    body?: string | {[field: string]: any};
    cache?: RequestCache;
    credentials?: RequestCredentials;
    headers?: Record<string, string>;
    integrity?: string;
    keepalive?: boolean;
    method?: string;
    mode?: RequestMode;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    signal?: AbortSignal | null;
    window?: any;
    open_timeout?: number; // used in various places, but unknown if supported
    timeout?: number;      // used in various places, but unknown if supported
};
export type FetchQueueEntry = [string, FetchOptions, ResolveFn<FetchResponse>, RejectFn];

export type fetchFn = (url: Parameters<typeof NodeFetchType>[0], options: FetchOptions) => Promise<FetchResponse>;

// Perform a HTTP request, enqueuing it if too many requests are already in
// progress to avoid hammering the server.
export const performFetch = (function() {
    const doFetch: fetchFn = typeof XMLHttpRequest === 'undefined' ? node_require('node-fetch') : fetchWithTimeout as any;
    const queue: FetchQueueEntry[] = [];
    let count = 0;
    const maxCount = 5;
    const next = () => {
        if (count >= maxCount) {
            return;
        }
        const req = queue.shift();
        if (!req) {
            return;
        }
        const [url, options, resolve, reject] = req;

        if (options.headers === undefined) {
            options.headers = {};
        }

        if (typeof options.body !== "undefined") {
            // fetch expects a stringified body
            if (typeof options.body === "object") {
                options.body = JSON.stringify(options.body);
            }

            // If content-type header is not explicitly set, we should set it ourselves
            if (typeof options.headers['content-type'] === "undefined") {
                options.headers['content-type'] = 'application/json;charset=utf-8';
            }
        }

        if (!options.headers['accept']){
            options.headers['accept'] = 'application/json';
        }

        ++count;
        // node doesn't support Promise.prototype.finally until 10
        doFetch(url, options)
            .then(response => {
                --count;
                next();
                resolve(response);
            })
            .catch(error => {
                --count;
                next();
                reject(error);
            });
    };
    return (url: string, options: FetchOptions) => {
        return new Promise<FetchResponse>((resolve, reject) => {
            queue.push([url, options, resolve, reject]);
            next();
        });
    };
})();