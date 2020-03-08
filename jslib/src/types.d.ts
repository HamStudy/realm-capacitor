////////////////////////////////////////////////////////////////////////////
//
// Copyright 2017 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////

// TypeScript Version: 2.3.2
// With great contributions to @akim95 on github

import SubscriptionState = Realm.Sync.SubscriptionState;
import { Configuration } from "realm";

declare namespace Realm {
    interface CollectionChangeSet {
        insertions: number[];
        deletions: number[];
        modifications: number[];
        newModifications: number[];
        oldModifications: number[];
    }

    type CollectionChangeCallback<T> = (collection: Collection<T>, change: CollectionChangeSet) => void;


    enum UpdateMode {
        Never = 'never',
        Modified = 'modified',
        All = 'all'
    }

    /**
     * A function which can be called to migrate a Realm from one version of the schema to another.
     */
    type MigrationCallback = (oldRealm: Realm, newRealm: Realm) => void;

    /**
     * realm configuration
     * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~Configuration }
     */
    interface Configuration {
        encryptionKey?: ArrayBuffer | ArrayBufferView | Int8Array;
        migration?: MigrationCallback;
        shouldCompactOnLaunch?: (totalBytes: number, usedBytes: number) => boolean;
        path?: string;
        fifoFilesFallbackPath?: string;
        readOnly?: boolean;
        inMemory?: boolean;
        schema?: (ObjectClass | ObjectSchema)[];
        schemaVersion?: number;
        sync?: Partial<Realm.Sync.SyncConfiguration>;
        deleteRealmIfMigrationNeeded?: boolean;
        disableFormatUpgrade?: boolean;
    }

    /**
     * realm configuration used for overriding default configuration values.
     * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~Configuration }
     */
    interface PartialConfiguration extends Partial<Realm.Configuration> {
    }


   

}

/**
 * Sync
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.html }
 */
declare namespace Realm.Sync {




interface NamedSubscription {
    readonly name: string,
    readonly objectType: string,
    query: string
    readonly state: SubscriptionState;
    readonly error: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly expiresAt: Date;
    timeToLive: number;
}

declare class Realm {
    static defaultPath: string;

    readonly empty: boolean;
    readonly path: string;
    readonly readOnly: boolean;
    readonly schema: Realm.ObjectSchema[];
    readonly schemaVersion: number;
    readonly isInTransaction: boolean;
    readonly isClosed: boolean;

    readonly syncSession: Realm.Sync.Session | null;

    /**
     * Get the current schema version of the Realm at the given path.
     * @param  {string} path
     * @param  {any} encryptionKey?
     * @returns number
     */
    static schemaVersion(path: string, encryptionKey?: ArrayBuffer | ArrayBufferView): number;

    /**
     * Open a realm asynchronously with a promise. If the realm is synced, it will be fully synchronized before it is available.
     * @param {Configuration} config
     */
    static open(config: Realm.Configuration): ProgressPromise;
    /**
     * @deprecated in favor of `Realm.open`
     * Open a realm asynchronously with a callback. If the realm is synced, it will be fully synchronized before it is available.
     * @param {Configuration} config
     * @param {Function} callback will be called when the realm is ready.
     * @param {ProgressNotificationCallback} progressCallback? a progress notification callback for 'download' direction and 'forCurrentlyOutstandingWork' mode
     */
    static openAsync(config: Realm.Configuration, callback: (error: any, realm: Realm) => void, progressCallback?: Realm.Sync.ProgressNotificationCallback): void

    /**
     * @deprecated in favor of `Realm.Sync.User.createConfiguration()`.
     * Return a configuration for a default Realm.
     * @param {Realm.Sync.User} optional user.
     */
    static automaticSyncConfiguration(user?: Realm.Sync.User): Configuration;

    /**
     * @param {Realm.ObjectSchema} object schema describing the object that should be created.
     * @returns {T}
     */
    static createTemplateObject<T>(objectSchema: Realm.ObjectSchema): T & Realm.Object;

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
     * Checks if the Realm already exists on disk.
     */
    static exists(config: Realm.Configuration): boolean;

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

declare module 'realm' {
    export = Realm
}
