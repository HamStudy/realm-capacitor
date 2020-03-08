
import { getRealmConstructor } from '../resolveRealmConstructor';
const realmConstructor = getRealmConstructor();

function openLocalRealm(realmConstructor: typeof Realm, config: Realm.Configuration) {
    let promise: Realm.ProgressPromise = Promise.resolve(new realmConstructor(config)) as any;
    promise.progress = (callback) => { return promise; };
    promise.cancel = () => { };
    return promise;
}

abstract class AbstractRealmBase {
    static defaultPath: string;

    readonly empty: boolean;
    readonly path: string;
    readonly readOnly: boolean;
    readonly schema: Realm.ObjectSchema[];
    readonly schemaVersion: number;
    readonly isInTransaction: boolean;
    readonly isClosed: boolean;

    readonly syncSession: Realm.Sync.Session;

    /**
     * Open a realm asynchronously with a promise. If the realm is synced, it will be fully synchronized before it is available.
     * @param {Configuration} config
     */
    static open(config?: Realm.Configuration): Realm.ProgressPromise {
        // If no config is defined, we should just open the default realm
        if (config === undefined) {
            config = {};
        }

        // For local Realms we open the Realm and return it in a resolved Promise.
        if (!("sync" in config)) {
            return openLocalRealm(realmConstructor, config);
        }

        // Determine if we are opening an existing Realm or not.
        let behavior = realmConstructor.exists(config) ? <const>"existingRealmFileBehavior" : <const>"newRealmFileBehavior";

        // Define how the Realm file is opened
        let openLocalRealmImmediately = false; // Default is downloadBeforeOpen
        if (config.sync[behavior] !== undefined) {
            const type = config.sync[behavior].type;
            switch (type) {
                case 'downloadBeforeOpen':
                    openLocalRealmImmediately = false;
                    break;
                case 'openImmediately':
                    openLocalRealmImmediately = true;
                    break;
                default:
                    throw Error(`Invalid type: '${type}'. Only 'downloadBeforeOpen' and 'openImmediately' is allowed.`);
            }
        }

        // If configured to do so, the synchronized Realm will be opened locally immediately.
        // If this is the first time the Realm is created, the schema will be created locally as well.
        if (openLocalRealmImmediately) {
            return openLocalRealm(realmConstructor, config);
        }

        // Otherwise attempt to synchronize the Realm state from the server before opening it.

        // First configure any timeOut and corresponding behavior.
        let openPromises: Promise<Realm>[] = [];
        if (config.sync[behavior] !== undefined && config.sync[behavior].timeOut !== undefined) {
            let timeOut = config.sync[behavior].timeOut;
            if (typeof timeOut !== 'number') {
                throw new Error(`'timeOut' must be a number: '${timeOut}'`);
            }

            // Define the behavior in case of a timeout
            let throwOnTimeOut = true; // Default is to throw
            if (config.sync[behavior] !== undefined && config.sync[behavior].timeOutBehavior) {
                const timeOutBehavior = config.sync[behavior].timeOutBehavior;
                switch (timeOutBehavior) {
                    case 'throwException':
                        throwOnTimeOut = true;
                        break;
                    case <any>'openLocal': // left for backwards compatibility, didn't match defined types
                    case 'openLocalRealm':
                        throwOnTimeOut = false;
                        break;
                    default:
                        throw Error(`Invalid 'timeOutBehavior': '${timeOutBehavior}'. Only 'throwException' and 'openLocal' is allowed.`);
                }
            }

            openPromises.push(new Promise<Realm>((resolve, reject) => {
                setTimeout(() => {
                    if (asyncOpenTask) {
                        asyncOpenTask.cancel();
                        asyncOpenTask = null;
                    }
                    if (throwOnTimeOut) {
                        reject(new Error(`${config.sync.url} could not be downloaded in the allocated time: ${timeOut} ms.`));
                    } else {
                        return resolve(openLocalRealm(realmConstructor, config));
                    }
                }, timeOut);
            }));
        }

        // Configure promise responsible for downloading the Realm from the server
        let asyncOpenTask: Realm.AsyncOpenTask;
        let cancelled = false;
        openPromises.push(new Promise<Realm>((resolve, reject) => {
            asyncOpenTask = (<any>realmConstructor)._asyncOpen(config, (realm: Realm, error?: Error) => {
                setTimeout(() => {
                    asyncOpenTask = null;
                    // The user may have cancelled the open between when
                    // the download completed and when we managed to
                    // actually invoke this, so recheck here.
                    if (cancelled) {
                        return;
                    }
                    if (error) {
                        reject(error);
                    } else {
                        resolve(realm);
                    }
                }, 0);
            });
        }));

        // Return wrapped promises, allowing the users to control them.
        let openPromise: Realm.ProgressPromise = Promise.race(openPromises);
        openPromise.cancel = () => {
            if (asyncOpenTask) {
                asyncOpenTask.cancel();
                cancelled = true;
            }
        };
        openPromise.progress = (callback) => {
            if (asyncOpenTask) {
                asyncOpenTask.addDownloadNotification(callback);
            }
            return openPromise;
        };
        return openPromise;
    }

    /**
     * @deprecated in favor of `Realm.open`
     * Open a realm asynchronously with a callback. If the realm is synced, it will be fully synchronized before it is available.
     * @param {Configuration} config
     * @param {Function} callback will be called when the realm is ready.
     * @param {ProgressNotificationCallback} progressCallback? a progress notification callback for 'download' direction and 'forCurrentlyOutstandingWork' mode
     */
    static openAsync(config: Realm.Configuration, callback: (error: Error|undefined, realm?: Realm) => void, progressCallback?: Realm.Sync.ProgressNotificationCallback): void {
        const message = "Realm.openAsync is now deprecated in favor of Realm.open. This function will be removed in future versions.";
        (console.warn || console.log).call(console, message);

        let promise = this.open(config)
        if (progressCallback) {
            promise.progress(progressCallback)
        }

        promise.then(realm => {
            callback(void 0, realm)
        }).catch(error => {
            callback(error);
        });
    }
    /**
     * @deprecated in favor of `Realm.Sync.User.createConfiguration()`.
     * Return a configuration for a default Realm.
     * @param {Realm.Sync.User} optional user.
     */
    static automaticSyncConfiguration(this: typeof Realm, user?: User): Realm.Configuration {
            if (arguments.length === 0) {
                let users = this.Sync.User.all;
                let identities = Object.keys(users);
                if (identities.length === 1) {
                    user = users[identities[0]];
                } else {
                    new Error(`One and only one user should be logged in but found ${users.length} users.`);
                }
            } else if (arguments.length === 1) {
                user = arguments[0];
            } else {
                new Error(`Zero or one argument expected.`);
            }

            let url = new URL(user.server);
            let secure = (url.protocol === 'https:')?'s':'';
            let port = (url.port === undefined)?'9080':url.port
            let realmUrl = `realm${secure}://${url.hostname}:${port}/default`;

            let config: Realm.Configuration = {
                sync: {
                    user: user,
                    url: realmUrl,
                }
            };
            return config;
        }

    /**
     * @param {Realm.ObjectSchema} object schema describing the object that should be created.
     * @returns {T}
     */
    static createTemplateObject<T extends Realm.ObjectSchema>(objectSchema: T): Realm.Object<T> {
        let obj: any = {};
        for (let key in objectSchema.properties) {

            let type = objectSchema.properties[key];
            if (typeof type === 'string' || type instanceof String) {
                // Simple declaration of the type
                type = objectSchema.properties[key];
            } else {
                // Advanced property setup
                const property = type;

                // if optional is set, it wil take precedence over any `?` set on the type parameter
                if (property.optional === true) {
                    continue;
                }

                // If a default value is explicitly set, always set the property
                if ('default' in property && property.default !== undefined) {
                    obj[key] = property.default;
                    continue;
                }

                type = property.type;
            }

            // Set the default value for all required primitive types.
            // Lists are always treated as empty if not specified and references to objects are always optional
            switch (type) {
                case 'bool': obj[key] = false; break;
                case 'int': obj[key] = 0; break;
                case 'float': obj[key] = 0.0; break;
                case 'double': obj[key] = 0.0; break;
                case 'string': obj[key] = ""; break;
                case 'data': obj[key] = new ArrayBuffer(0); break;
                case 'date': obj[key] = new Date(0); break;
            }
        }
        return obj;
    }

    /**
     * Delete the Realm file for the given configuration.
     * @param {Configuration} config
     */
    static deleteFile(config: Realm.Configuration): void;

    /**
     * Copy all bundled Realm files to app's default file folder.
     */
    static copyBundledRealmFiles(): void;

    /**
     * Clears the state by closing and deleting any Realm in the default directory and logout all users.
     * @private Not a part of the public API: It's primarily used from the library's tests.
     */
    static clearTestState(): void;

    /**
     * @param  {Realm.Configuration} config?
     */
    constructor(config?: Realm.Configuration);

    /**
     * @param  {string} path
     */
    constructor(path?: string);

    /**
     * @returns void
     */
    close(): void;

    /**
     * @param  {string|Realm.ObjectClass|Function} type
     * @param  {T&Realm.ObjectPropsType} properties
     * @param  {boolean} update?
     * @returns T
     *
     * @deprecated, to be removed in future versions. Use `create(type, properties, UpdateMode)` instead.
     */
    create<T>(type: string | Realm.ObjectClass | Function, properties: T | Realm.ObjectPropsType, update?: boolean): T;

    /**
     * @param  {string|Realm.ObjectClass|Function} type
     * @param  {T&Realm.ObjectPropsType} properties
     * @param  {Realm.UpdateMode} mode? If not provided, `Realm.UpdateMode.Never` is used.
     * @returns T
     */
    create<T>(type: string | Realm.ObjectClass | Function, properties: T | Realm.ObjectPropsType, mode?: Realm.UpdateMode): T;

    /**
     * @param  {Realm.Object|Realm.Object[]|Realm.List<any>|Realm.Results<any>|any} object
     * @returns void
     */
    delete(object: Realm.Object | Realm.Object[] | Realm.List<any> | Realm.Results<any> | any): void;

    /**
     * @returns void
     */
    deleteModel(name: string): void;

    /**
     * @returns void
     */
    deleteAll(): void;

    /**
     * @param  {string|Realm.ObjectType|Function} type
     * @param  {number|string} key
     * @returns {T | undefined}
     */
    objectForPrimaryKey<T>(type: string | Realm.ObjectType | Function, key: number | string): T & Realm.Object | undefined;

    /**
     * @param  {string|Realm.ObjectType|Function} type
     * @param  {string} id
     * @returns {T | undefined}
     */
    objectForPrimaryKey<T>(type: string | Realm.ObjectType | Function, id: string): T & Realm.Object | undefined;

    /**
     * @param  {string|Realm.ObjectType|Function} type
     * @returns Realm
     */
    objects<T>(type: string | Realm.ObjectType | Function): Realm.Results<T & Realm.Object>;

    /**
     * @param  {string} name
     * @param  {()=>void} callback
     * @returns void
     */
    addListener(name: string, callback: (sender: Realm, event: 'change') => void): void;
    addListener(name: string, callback: (sender: Realm, event: 'schema', schema: Realm.ObjectSchema[]) => void): void;

    /**
     * @param  {string} name
     * @param  {()=>void} callback
     * @returns void
     */
    removeListener(name: string, callback: (sender: Realm, event: 'change') => void): void;
    removeListener(name: string, callback: (sender: Realm, event: 'schema', schema: Realm.ObjectSchema[]) => void): void;

    /**
     * @param  {string} name?
     * @returns void
     */
    removeAllListeners(name?: string): void;

    /**
     * @param  {()=>void} callback
     * @returns void
     */
    write(callback: () => void): void;

    /**
     * @returns void
     */
    beginTransaction(): void;

    /**
     * @returns void
     */
    commitTransaction(): void;

    /**
     * @returns void
     */
    cancelTransaction(): void;

    /**
     * @returns boolean
     */
    compact(): boolean;

    /**
     * Write a copy to destination path
     * @param path destination path
     * @param encryptionKey encryption key to use
     * @returns void
     */
    writeCopyTo(path: string, encryptionKey?: ArrayBuffer | ArrayBufferView): void;

    privileges(): Realm.Permissions.RealmPrivileges;
    privileges(objectType: string | Realm.ObjectSchema | Function): Realm.Permissions.ClassPrivileges;
    privileges(obj: Realm.Object): Realm.Permissions.ObjectPrivileges;

    permissions(): Realm.Permissions.Realm;
    permissions(objectType: string | Realm.ObjectSchema | Function): Realm.Permissions.Class;

    subscriptions(name?: string): Realm.Results<NamedSubscription>;
    unsubscribe(name: string): void;

    /**
     * Update the schema of the Realm.
     *
     * @param schema The schema which the Realm should be updated to use.
     * @private Not a part of the public API: Consider passing a `schema` when constructing the `Realm` instead.
     */
    _updateSchema(schema: Realm.ObjectSchema[]): void;
}
/**
 * Static functions from native code defined in here
 */
declare namespace AbstractRealmBase {
    /**
     * Get the current schema version of the Realm at the given path.
     * @param  {string} path
     * @param  {any} encryptionKey?
     * @returns number
     */
    export function schemaVersion(path: string, encryptionKey?: ArrayBuffer | ArrayBufferView): number;

    /**
     * Checks if the Realm already exists on disk.
     */
    export function exists(config: Realm.Configuration): boolean;
}

class Realm extends AbstractRealmBase {
}

import * as SyncNS from './Sync';
import * as SchemaTypes from './Schema';
import * as ConfigurationTypes from './Configuration';
import * as RealmObject from './RealmObject';
import { User } from './Sync/PermissionMixin';
namespace Realm {
    export import AbstractRealm = AbstractRealmBase;

    export interface ProgressPromise extends Promise<Realm> {
        cancel?(): void;
        progress?(callback: Realm.Sync.ProgressNotificationCallback): Promise<Realm>;
    }
    export interface AsyncOpenTask {
        cancel?(): void;
        addDownloadNotification?(callback: (transferredBytes: number, totalBytes: number) => void): void;
    }
    
    // Export the Sync namespace 
    export import Sync = SyncNS;

    // Export Object type(s)
    export import Object = RealmObject.Object;
    export import ObjectPropsType = RealmObject.ObjectPropsType;
    export import ObjectChangeSet = RealmObject.ObjectChangeSet;
    export import ObjectChangeCallback = RealmObject.ObjectChangeCallback;

    // Re-export types from 'configuration'
    export import ObjectSchema = SchemaTypes.ObjectSchema;
    export import ObjectClass = SchemaTypes.ObjectClass;
    export import ObjectType = SchemaTypes.ObjectType;
    export import Configuration = ConfigurationTypes.Configuration;
    export import MigrationCallback = ConfigurationTypes.MigrationCallback;
    export import PartialConfiguration = ConfigurationTypes.PartialConfiguration;
}

export { Realm };
