import { User } from './User';
import { SSLConfiguration } from './Session';

export * from './Session';

export interface UserInfo {
    id: string;
    isAdmin: boolean;
}

export interface Account {
    provider_id: string;
    provider: string;
    user: UserInfo
}

export interface SubscriptionOptions {
    name?: string;
    update?: boolean;
    timeToLive?: number;
    includeLinkingObjects?: string[];
}

export {Credentials, AdminCredentials, IdentityProviders} from './Credentials';



export type AccessLevel = 'none' | 'read' | 'write' | 'admin';

export class PermissionChange {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    statusCode?: number;
    statusMessage?: string;
    userId: string;
    metadataKey?: string;
    metadataValue?: string;
    realmUrl: string;
    mayRead?: boolean;
    mayWrite?: boolean;
    mayManage?: boolean;
}

export type SubscriptionNotificationCallback = (subscription: Subscription, state: number) => void;

/**
 * Subscription
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.Subscription.html }
 */
export class Subscription {
    readonly state: SubscriptionState;
    readonly error: string;

    unsubscribe(): void;
    addListener(subscruptionCallback: SubscriptionNotificationCallback): void;
    removeListener(subscruptionCallback: SubscriptionNotificationCallback): void;
    removeAllListeners(): void;
}

export enum SubscriptionState {
    Error,
    Creating,
    Pending,
    Complete,
    Invalidated,
}

/**
* AuthError
* @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.AuthError.html }
*/
export {AuthError} from '../../errors';

/**
 * ChangeEvent
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.ChangeEvent.html }
 */
export interface ChangeEvent {
    readonly changes: { [object_type: string]: CollectionChangeSet };
    readonly oldRealm: Realm;
    readonly path: string;
    readonly realm: Realm;
}

export type RealmListenerEventName = 'available' | 'change' | 'delete';

export interface RealmListenerConfiguration {
    serverUrl: string;
    adminUser: User;
    filterRegex: string;
    sslConfiguration?: SSLConfiguration;
}

export type LogLevel = 'all' | 'trace' | 'debug' | 'detail' | 'info' | 'warn' | 'error' | 'fatal' | 'off';

export enum NumericLogLevel {
    All,
    Trace,
    Debug,
    Detail,
    Info,
    Warn,
    Error,
    Fatal,
    Off,
}

/**
 * LocalRealm
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.LocalRealm.html }
 */
export interface LocalRealm {
    readonly path: string;
    realm(): Realm;
}

export type RealmWatchPredicate = (realmPath: string) => boolean;

/**
 * @deprecated, to be removed in future versions
 */
export function addListener(serverURL: string, adminUser: Realm.Sync.User, regex: string, name: RealmListenerEventName, changeCallback: (changeEvent: ChangeEvent) => void): Promise<void>;
/**
 * @deprecated, to be removed in future versions
 */
export function addListener(serverURL: string, adminUser: Realm.Sync.User, regex: string, name: RealmListenerEventName, changeCallback: (changeEvent: ChangeEvent) => Promise<void>): Promise<void>;
export function addListener(config: RealmListenerConfiguration, eventName: RealmListenerEventName, changeCallback: (changeEvent: ChangeEvent) => void): Promise<void>;
export function addListener(config: RealmListenerConfiguration, eventName: RealmListenerEventName, changeCallback: (changeEvent: ChangeEvent) => Promise<void>): Promise<void>;
export function removeAllListeners(): Promise<void>;
export function removeListener(regex: string, name: string, changeCallback: (changeEvent: ChangeEvent) => void): Promise<void>;
export function setLogLevel(logLevel: LogLevel): void;
export function setLogger(callback: (level: NumericLogLevel, message: string) => void): void;
export function setUserAgent(userAgent: string): void;
export function initiateClientReset(path: string): void;
export function _hasExistingSessions(): boolean;
export function reconnect(): void;
export function localListenerRealms(regex: string): Array<LocalRealm>;

/**
 * @deprecated, to be removed in future versions
 */
export function setFeatureToken(token: string): void;

export type Instruction = {
    type: 'INSERT' | 'SET' | 'DELETE' | 'CLEAR' | 'LIST_SET' | 'LIST_INSERT' | 'LIST_ERASE' | 'LIST_CLEAR' | 'ADD_TYPE' | 'ADD_PROPERTIES' | 'CHANGE_IDENTITY' | 'SWAP_IDENTITY'
    object_type: string,
    identity: string,
    values: any | undefined
    list_index: any | undefined
    object_identity: any | undefined
    new_identity: any | undefined,
    property: any | undefined,
    properties: any | undefined,
    primary_key: string | undefined
}

export class Adapter {
    constructor(
        local_path: string,
        server_url: string,
        admin_user: User,
        filter: string | RealmWatchPredicate,
        change_callback: Function,
        ssl?: SSLConfiguration
    ) {};

        /**
         * Advance the to the next transaction indicating that you are done processing the current instructions for the given Realm.
         * @param path the path for the Realm to advance
         */
        advance(path: string): void;
        close(): void;
        current(path: string): Array<Instruction>;
        realmAtPath(path: string, schema?: ObjectSchema[]): Realm
    }
}