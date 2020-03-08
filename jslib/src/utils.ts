
interface KnownModules {
    'url-parse': typeof import ('url-parse'),
    'os': typeof import ('os'),
    'node-fetch': typeof import ('node-fetch'),
};
type TypeOfModule<ModName extends string, DefType = any> = 
    ModName extends keyof KnownModules ? KnownModules[ModName]
    : DefType;

const require_method = require;
export function node_require<ModuleName extends string, ModType = any>(module: ModuleName) : TypeOfModule<ModuleName, ModType> {
    return require_method(module);
}

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };
export type TypeOfSet<T extends Set<any>> = T extends Set<infer U> ? U : never;

export function checkTypes(args: any[] | IArguments, types: string[]) {
    args = Array.prototype.slice.call(args);
    for (var i = 0; i < types.length; ++i) {
        if (args.length > i && typeof args[i] !== types[i]) {
            throw new TypeError('param ' + i + ' must be of type ' + types[i]);
        }
    }
}

export function checkObjectTypes<T extends object>(obj: T, types: Record<keyof T, string>) {
    for (const name of Object.getOwnPropertyNames(types) as (keyof T)[]) {
        const actualType = typeof obj[name];
        let targetType = types[name];
        const isOptional = targetType[targetType.length - 1] === '?';
        if (isOptional) {
            targetType = targetType.slice(0, -1);
        }

        if (!isOptional && actualType === 'undefined') {
            throw new Error(`${name} is required, but a value was not provided.`);
        }

        if (actualType !== targetType) {
            throw new TypeError(`${name} must be of type '${targetType}' but was of type '${actualType}' instead.`);
        }
    }
}

export function print_error(...args: any[]) {
    (console.error || console.log).apply(console, args);
}

// this is just a type that will never appear in actual life used to check for any
type CheckAny = '999999937' & {'999999937': true};
export type MethodKeysOnly<T extends object, Keys extends keyof T = keyof T, E extends string = never> = {
    [K in Keys]:
        K extends E ? never : // exclude anything in the exclude list
        T[K] extends CheckAny ? never : // exclude all with type "any"
        T[K] extends Function ? K : never; // Keep functions, discard other
}
export function isFunction(functionToCheck: any) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}

// using Set for performance
const excludeStaticKeys = new Set(<const>['prototype']); 
const excludeInstanceKeys = new Set(<const>['toJSON', 'constructor']);

function extractKeys<T extends object, K extends keyof T>(obj: T, keys: readonly K[]) : Pick<T, K> {
    let out: any = {};
    for (let k of keys) {
        if (isFunction(obj[k])) { out[k] = obj[k]; }
    }
    return out;
}
export function extractMethods<T extends object, ExcludeKeys extends Set<unknown>>(obj: T, exclude: ExcludeKeys) {
    type keys = keyof T;
    const allKeys = Object.keys(obj) as (keyof T)[];
    const keepKeys = allKeys.filter(k => !excludeStaticKeys.has(k as any)) as Exclude<keys, TypeOfSet<ExcludeKeys>>[];

    return extractKeys(obj, keepKeys);
}
export function extractStaticMethods<T extends object>(obj: T) {
    return extractMethods(obj, excludeStaticKeys);
}
export function extractInstanceMethods<T extends object>(obj: T) {
    return extractMethods(obj, excludeInstanceKeys);
}