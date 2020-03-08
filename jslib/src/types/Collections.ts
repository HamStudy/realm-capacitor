import { PropertyType } from "./Schema";

/**
 * SortDescriptor
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Collection.html#~SortDescriptor }
 */
export type SortDescriptor = [string] | [string, boolean];

/**
 * Collection
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Collection.html }
 */
export interface Collection<T> extends ReadonlyArray<T> {
    readonly type: PropertyType;
    readonly optional: boolean;

    description(): string;

    /**
     * @returns boolean
     */
    isValid(): boolean;

    /**
     * @returns boolean
     */
    isEmpty(): boolean;

    min(property?: string): number | Date | null;
    max(property?: string): number | Date | null;
    sum(property?: string): number | null;
    avg(property?: string): number;

    /**
     * @param  {string} query
     * @param  {any[]} ...arg
     * @returns Results
     */
    filtered(query: string, ...arg: any[]): Results<T>;

    sorted(reverse?: boolean): Results<T>;
    sorted(descriptor: SortDescriptor[]): Results<T>;
    sorted(descriptor: string, reverse?: boolean): Results<T>;

    /**
     * @returns Results<T>
     */
    subscribe(subscriptionName?: string): Realm.Sync.Subscription;
    subscribe(options?: Realm.Sync.SubscriptionOptions): Realm.Sync.Subscription;

    /**
     * @returns Results
     */
    snapshot(): Results<T>;

    /**
     * @param  {(collection:any,changes:any)=>void} callback
     * @returns void
     */
    addListener(callback: CollectionChangeCallback<T>): void;

    /**
     * @returns void
     */
    removeAllListeners(): void;

    /**
     * @param  {()=>void} callback this is the callback to remove
     * @returns void
     */
    removeListener(callback: CollectionChangeCallback<T>): void;
}

export const Collection: {
    readonly prototype: Collection<any>;
};

/**
 * List
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.List.html }
 */
export interface List<T> extends Collection<T> {
    [n: number]: T;

    pop(): T | null | undefined;

    /**
     * @param  {T} object
     * @returns number
     */
    push(...object: T[]): number;

    /**
     * @returns T
     */
    shift(): T | null | undefined;

    unshift(...object: T[]): number;

    /**
     * @param  {number} index
     * @param  {number} count?
     * @param  {any} object?
     * @returns T
     */
    splice(index: number, count?: number, object?: any): T[];
}

export const List: {
    readonly prototype: List<any>;
};

/**
 * Results
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Results.html }
 */
export interface Results<T> extends Collection<T> {
    /**
     * Bulk update objects in the collection.
     * @param  {string} property
     * @param  {any} value
     * @returns void
     */
    update(property: string, value: any): void;
}

export const Results: {
    readonly prototype: Results<any>;
};