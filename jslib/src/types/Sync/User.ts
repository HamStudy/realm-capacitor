import { AdminCredentials, Credentials } from "./Credentials";
import { checkTypes, checkObjectTypes, print_error } from "../../utils";
import { Session } from "./Session";
import { _authenticate, _updateAccount, refreshAccessToken, FetchOptions, performFetch, refreshTimers, normalizeSyncUrl } from "./SyncHelpers";
import ParseUrl from 'url-parse';
import merge from 'deepmerge';
import { AuthError } from "../../errors";

import {Mixin as PermissionMixin, Permission, PermissionCondition, AccessLevel, PermissionOffer} from './PermissionMixin';
import { PartialConfiguration, Configuration } from "../Configuration";

export interface SerializedUser {
    server: string;
    refreshToken: string;
    identity: string;
    isAdmin: boolean;
}

export interface SerializedTokenUser {
    server: string;
    adminToken: string;
}


/**
 * User
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.User.html }
 */
abstract class User {
    /**
     * Reference to the constructor of the object
     */
    readonly ['constructor']: typeof User;
    static readonly all: { [identity: string]: User };
    static get current() {
        const allUsers = this.all;
        const keys = Object.keys(allUsers);
        if (keys.length === 0) {
            return undefined;
        } else if (keys.length > 1) {
            throw new Error("Multiple users are logged in");
        }

        return allUsers[keys[0]];
    }
    readonly identity: string;
    readonly isAdmin: boolean;
    readonly isAdminToken: boolean;
    readonly server: string;
    readonly token: string;

    // /** @deprecated, to be removed in future versions */
    static login(server: string, username: string, password: string): Promise<User>;
    static login(server: string, credentials: AdminCredentials): User;
    static login(server: string, credentials: Credentials): Promise<User>;
    static login(server: string, credentials: Credentials|string, pw?: string) {
        if (arguments.length === 3 || typeof credentials === 'string') {
            // Deprecated legacy signature.
            checkTypes(arguments, ['string', 'string', 'string']);
            console.warn("User.login is deprecated. Please use User.login(server, Credentials.usernamePassword(...)) instead.");
            const newCredentials = Credentials.usernamePassword(arguments[1], arguments[2], /* createUser */ false);
            return this.login(server, newCredentials);
        }

        checkTypes(arguments, ['string', 'object']);
        if (credentials.identityProvider === 'adminToken') {
            let u = this._adminUser(server, credentials.token);
            return u;
        }

        return _authenticate(this, server, credentials, 0);
    }

    static requestPasswordReset(server: string, email: string): Promise<void> {
        checkTypes(arguments, ['string', 'string']);
        const json = {
            provider_id: email,
            data: { action: 'reset_password' }
        };

        return _updateAccount(this, server, json);
    }

    static completePasswordReset(server: string, resetToken: string, newPassword: string): Promise<void> {
        checkTypes(arguments, ['string', 'string']);
        const json = {
            data: {
                action: 'complete_reset',
                token: resetToken,
                new_password: newPassword
            }
        };

        return _updateAccount(this, server, json);
    }

    static requestEmailConfirmation(server: string, email: string): Promise<void> {
        checkTypes(arguments, ['string', 'string']);
        const json = {
            provider_id: email,
            data: { action: 'request_email_confirmation' }
        };

        return _updateAccount(this, server, json);
    }

    static confirmEmail(server: string, confirmationToken: string): Promise<void> {
        checkTypes(arguments, ['string', 'string']);
        const json = {
            data: {
                action: 'confirm_email',
                token: confirmationToken
            }
        };

        return _updateAccount(this, server, json);
    }

    static deserialize(serialized: SerializedUser | SerializedTokenUser): User {
        if ('adminToken' in serialized) {
            checkObjectTypes(serialized, {
                server: 'string',
                adminToken: 'string',
            });

            return this._adminUser(serialized.server, serialized.adminToken);
        }

        checkObjectTypes(serialized, {
            server: 'string',
            identity: 'string',
            refreshToken: 'string',
            isAdmin: 'boolean',
        });

        return this.createUser(serialized.server, serialized.identity, serialized.refreshToken, false, serialized.isAdmin || false);
    }

    createConfiguration(config?: PartialConfiguration): Configuration {
        if (config && config.sync) {
            if (config.sync.user && console.warn !== undefined) {
                console.warn(`'user' property will be overridden by ${this.identity}`);
            }
            if (config.sync.partial !== undefined && config.sync.fullSynchronization !== undefined) {
                throw new Error("'partial' and 'fullSynchronization' were both set. 'partial' has been deprecated, use only 'fullSynchronization'");
            }
        }

        let defaultConfig: Configuration = {
            sync: {
                user: this,
            },
        };

        // Set query-based as the default setting if the user doesn't specified any other behaviour.
        if (!(config && config.sync && config.sync.partial)) {
            defaultConfig.sync.fullSynchronization = false;
        }

        // Merge default configuration with user provided config. User defined properties should aways win.
        // Doing the naive merge in JS break objects that are backed by native objects, so these needs to
        // be merged manually. This is currently only `sync.user`.
        let mergedConfig = (config === undefined) ? defaultConfig : merge(defaultConfig, config);
        mergedConfig.sync.user = this;

        // Parsing the URL requires extra handling as some forms of input (e.g. relative URLS) should not completely
        // override the default url.
        mergedConfig.sync.url = normalizeSyncUrl(this.server, (config && config.sync) ? config.sync.url : undefined);
        return mergedConfig;
    }
    serialize(): SerializedUser | SerializedTokenUser {
        if (this.isAdminToken) {
            return {
                server: this.server,
                adminToken: this.token,
            }
        }

        return {
            server: this.server,
            refreshToken: this.token,
            identity: this.identity,
            isAdmin: this.isAdmin,
        };
    }
    logout(): Promise<void> {
        this._logout();
        const userTimers = refreshTimers[this.identity];
        if (userTimers) {
            Object.keys(userTimers).forEach((key) => {
                clearTimeout(userTimers[key]);
            });

            delete refreshTimers[this.identity];
        }

        const options = {
            method: 'POST',
            headers: { Authorization: this.token },
            body: { token: this.token },
        };

        return this._performFetch<any>('/auth/revoke', options)
            .catch((e: Error) => print_error('An error occurred while logging out a user', e));
    }
    retrieveAccount(provider: string, provider_id: string): Promise<Account> {
        checkTypes(arguments, ['string', 'string']);
        const options = {
            method: 'GET',
            headers: { Authorization: this.token },
        };
        return this._performFetch(`/auth/users/${provider}/${provider_id}`, options);
    }

    getGrantedPermissions: (recipient: 'any' | 'currentUser' | 'otherUser') => Promise<Permission[]> = PermissionMixin.getGrantedPermissions;
    applyPermissions: (condition: PermissionCondition, realmUrl: string, accessLevel: AccessLevel) => Promise<void> = PermissionMixin.applyPermissions;
    offerPermissions: (realmUrl: string, accessLevel: AccessLevel, expiresAt?: Date) => Promise<string> = PermissionMixin.offerPermissions;
    acceptPermissionOffer: (token: string) => Promise<string> = PermissionMixin.acceptPermissionOffer;
    invalidatePermissionOffer: (permissionOfferOrToken: PermissionOffer | string) => Promise<string> = PermissionMixin.invalidatePermissionOffer;
    getPermissionOffers: () => Promise<PermissionOffer[]> = PermissionMixin.getPermissionOffers;

    _performFetch<T extends object>(relativePath: string, options: FetchOptions) : Promise<T> {
        if (options && !options.open_timeout === undefined) {
            options.open_timeout = 5000;
        }

        const url = ParseUrl(this.server);
        url.set('pathname', relativePath);

        return performFetch(url.href, options)
            .then((response) => {
                if (response.status !== 200) {
                    return response.json()
                        .then(body => {
                            throw new AuthError(body);
                        });
                }

                return response.json();
            });
    }

    // Can't find this in types anywhere, but keeping for backwards
    // compatibility
    static _refreshAccessToken = refreshAccessToken;

    // Methods implemented in native code
    abstract _sessionForOnDiskPath(localRealmPath: string) : Session;

    // Deprecated

    /** @deprecated, to be removed in future versions */
    static adminUser(adminToken: string, server?: string): User {
        checkTypes(arguments, ['string', 'string']);
        console.warn("User.adminUser is deprecated. Please use User.login(server, Credentials.adminToken(token)) instead.");
        const credentials = Credentials.adminToken(adminToken);
        return this.login(server, credentials);
    }
    /** @deprecated, to be removed in future versions */
    static register(server: string, username: string, password: string): Promise<User> {
        checkTypes(arguments, ['string', 'string', 'string']);
        console.warn("User.register is deprecated. Please use User.login(server, Credentials.usernamePassword(...)) instead.");
        const credentials = Credentials.usernamePassword(username, password, /* createUser */ true);
        return this.login(server, credentials);
    }
    /** @deprecated, to be removed in future versions */
    static registerWithProvider(server: string, options: { provider: string, providerToken: string, userInfo: any }): Promise<User> {
        checkTypes(arguments, ['string', 'object']);
        console.warn("User.registerWithProvider is deprecated. Please use User.login(server, Credentials.SOME-PROVIDER(...)) instead.");
        const credentials = Credentials.custom(options.provider, options.providerToken, options.userInfo);
        return this.login(server, credentials);
    }
    /** @deprecated, to be removed in future versions */
    static authenticate(server: string, provider: string, options: any): Promise<User> {
        checkTypes(arguments, ['string', 'string', 'object'])
        console.warn("User.authenticate is deprecated. Please use User.login(server, Credentials.SOME-PROVIDER(...)) instead.");

        let credentials;
        switch (provider.toLowerCase()) {
            case 'jwt':
                credentials = Credentials.jwt(options.token, 'jwt');
                break
            case 'password':
                credentials = Credentials.usernamePassword(options.username, options.password);
                break
            default:
                credentials = Credentials.custom(provider, options.data, options.user_info || options.userInfo);
                break;
        }

        return this.login(server, credentials);
    }
}

/**
 * User
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.User.html }
 * 
 * This namespace augmentation adds the static methods which are defined
 * in native code instead of javascript; there is no way to define
 * abstract static methods in typescript, so this hack is the workaround
 */
declare namespace User {
    /**
     * Creates a user and returns it
     * @param authServerUrl 
     * @param identity 
     * @param refreshToken 
     * @param unknown // TODO: I have no idea what this is, it isn't used in native code
     * @param isAdmin 
     */
    export function createUser(authServerUrl: string, identity: string, refreshToken: string, unknown?: boolean, isAdmin?: boolean): User;
    export function _adminUser(server: string, token: string) : User;
    export function _getExistingUser(server: string, identity: string): User;
}

export {User};
