import { ObjectClass, ObjectSchema } from "./Schema";
import * as Sync from './Sync';
import {Realm} from './Realm';

/**
 * A function which can be called to migrate a Realm from one version of the schema to another.
 */
export type MigrationCallback = (oldRealm: Realm, newRealm: Realm) => void;

/**
 * realm configuration
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~Configuration }
 */
export interface Configuration {
    encryptionKey?: ArrayBuffer | ArrayBufferView | Int8Array;
    migration?: MigrationCallback;
    shouldCompactOnLaunch?: (totalBytes: number, usedBytes: number) => boolean;
    path?: string;
    fifoFilesFallbackPath?: string;
    readOnly?: boolean;
    inMemory?: boolean;
    schema?: (ObjectClass | ObjectSchema)[];
    schemaVersion?: number;
    sync?: Partial<Sync.SyncConfiguration>;
    deleteRealmIfMigrationNeeded?: boolean;
    disableFormatUpgrade?: boolean;
}

/**
 * realm configuration used for overriding default configuration values.
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~Configuration }
 */
export type PartialConfiguration = Partial<Configuration>;
