////////////////////////////////////////////////////////////////////////////
//
// Copyright 2016 Realm Inc.
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

/* global navigator */

import './realm-api';

import URL from 'url-parse';
import * as userMethods from './user-methods';
import {AuthError} from './errors';
import { Session } from './types/Sync/Session';

function getOwnPropertyDescriptors(obj: Object) {
    return Object.getOwnPropertyNames(obj).reduce(function (descriptors, name) {
        descriptors[name] = Object.getOwnPropertyDescriptor(obj, name);
        return descriptors;
    }, {} as {[key: string]: PropertyDescriptor});
};
if ('getOwnPropertyDescriptors' in Object ) {
    (<any>getOwnPropertyDescriptors) = (<any>Object).getOwnPropertyDescriptors;
}

const subscriptionObjectNameRegex = /^(class_)?(.*?)(_matches)?$/gm;

function setConstructorOnPrototype(klass: {prototype?: any}) {
    if (klass.prototype.constructor !== klass) {
        Object.defineProperty(klass.prototype, 'constructor', { value: klass, configurable: true, writable: true });
    }
}

interface RealmObject {
    _realm: Realm;
}

function isString(s: any) : s is string {
    return typeof s === 'string' || s instanceof String;
}

/**
 * Finds the permissions associated with a given Role or create them as needed.
 *
 * @param {RealmObject} Container RealmObject holding the permission list.
 * @param {List<Realm.Permissions.Permission>} list of permissions.
 * @param {string} name of the role to find or create permissions for.
 */
function findOrCreatePermissionForRole(realmObject: RealmObject, permissions: Realm.List<Realm.Permissions.Permission>, roleName: string) {
    let realm = realmObject._realm;
    if (!realm.isInTransaction) {
        throw Error("'findOrCreate' can only be called inside a write transaction.");
    }
    let permissionsObj = permissions.filtered(`role.name = '${roleName}'`)[0];
    if (permissionsObj === undefined) {
        let role = realm.objects<Realm.Permissions.Role>("__Role").filtered(`name = '${roleName}'`)[0];
        if (role === undefined) {
            role = realm.create<Realm.Permissions.Role>("__Role", {'name': roleName}) as any;
        }
        // Create new permissions object with all privileges disabled
        permissionsObj = realm.create<Realm.Permissions.Permission>("__Permission", { 'role': role });
        permissions.push(permissionsObj);
    }
    return permissionsObj;
}

/**
 * Adds the schema object if one isn't already defined
 */
function addSchemaIfNeeded(schemaList: Realm.List<Realm.ObjectClass>, schemaObj: Realm.ObjectClass) {
    const name = schemaObj.schema.name;
    if (schemaList.find((obj: any) => obj?.name === name || obj?.schema.name === name) === undefined) {
        schemaList.push(schemaObj);
    }
}

export function waitForCompletion(session: Session, fn: (error?: Error) => void, timeout: number, timeoutErrorMessage: string) : Promise<void> {
    const waiter = new Promise<void>((resolve, reject) => {
        fn.call(session, (error: Error) => {
            if (error === undefined) {
                setTimeout(() => resolve(), 1);
            } else {
                setTimeout(() => reject(error), 1);
            }
        });
    });
    if (timeout === undefined) {
        return waiter;
    }
    return Promise.race([
        waiter,
        new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                reject(timeoutErrorMessage);
            }, timeout);
        })
    ]);
}

function LoadExtensions(realmConstructor: typeof Realm, context: {}) {
    // Add the specified Array methods to the Collection prototype.
    Object.defineProperties(realmConstructor.Collection.prototype, require('./collection-methods'));

    setConstructorOnPrototype(realmConstructor.Collection);
    setConstructorOnPrototype(realmConstructor.List);
    setConstructorOnPrototype(realmConstructor.Results);
    setConstructorOnPrototype(realmConstructor.Object);

    //Add static methods to the Realm object
    Object.defineProperties(realmConstructor, getOwnPropertyDescriptors({
        open(config: Realm.Configuration) ,

        openAsync(this: typeof Realm, config: Realm.Configuration, callback?: (err: Error|undefined, realm?: Realm) => void, progressCallback?: Realm.Sync.ProgressNotificationCallback) {
            const message = "Realm.openAsync is now deprecated in favor of Realm.open. This function will be removed in future versions.";
            (console.warn || console.log).call(console, message);

            let promise = this.open(config)
            if (progressCallback) {
                promise.progress(progressCallback)
            }

            promise.then(realm => {
                callback(null, realm)
            }).catch(error => {
                callback(error);
            });
        },

        createTemplateObject<SchemaType extends Realm.ObjectSchema>(objectSchema: SchemaType) {
            type PropType = typeof objectSchema.properties;;
            type PropertyKeys = keyof PropType;
            let obj: any = {};
            for (let key of Object.keys(objectSchema.properties) as PropertyKeys[]) {
                const property = objectSchema.properties[key];
                let type: Realm.PropertyType;
                if (isString(property)) {
                    // Simple declaration of the type
                    type = property;
                } else {
                    // Advanced property setup
                    // if optional is set, it wil take precedence over any `?` set on the type parameter
                    if (property.optional === true) {
                        continue;
                    }

                    // If a default value is explicitly set, always set the property
                    if ('default' in property && property.default !== undefined) {
                        (<any>obj)[key] = property.default;
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
            return obj as Realm.TypeOfSchema<SchemaType>;
        }
    }));

    // Add static properties to Realm Object
    const updateModeType = {
      All: 'all',
      Modified: 'modified',
      Never: 'never',
    };

    if (!realmConstructor.UpdateMode) {
      Object.defineProperty(realmConstructor, 'UpdateMode', {
        value: updateModeType,
        configurable: false,
      });
    }

    // Add sync methods
    if (realmConstructor.Sync) {
        Object.defineProperties(realmConstructor.Sync.User, getOwnPropertyDescriptors(userMethods.static));
        Object.defineProperties(realmConstructor.Sync.User.prototype, getOwnPropertyDescriptors(userMethods.instance));
        Object.defineProperty(realmConstructor.Sync.User, '_realmConstructor', { value: realmConstructor });

        (<any>realmConstructor.Sync.Credentials) = {};
        
        Object.defineProperties(realmConstructor.Sync.Credentials, getOwnPropertyDescriptors(userMethods.credentials));
        realmConstructor.Sync.AuthError = AuthError as any;

        if (realmConstructor.Sync.removeAllListeners) {
            process.on('exit', realmConstructor.Sync.removeAllListeners);
            process.on('SIGINT', function () {
                realmConstructor.Sync.removeAllListeners();
                process.exit(2);
            });
            process.on('uncaughtException', function(e) {
                realmConstructor.Sync.removeAllListeners();
                /* eslint-disable no-console */
                console.log(e.stack);
                process.exit(99);
            });
        }

        //back compat. setSyncLogger is deprecated.
        if (!(<any>realmConstructor).Sync.setSyncLogger) {
            (<any>realmConstructor).Sync.setSyncLogger = function (level: any, message: string) {
                // TODO: According to the typescript types this is not a valid call
                (<any>realmConstructor).Sync.setLogger(level, message);
            }
        }

        setConstructorOnPrototype(realmConstructor.Sync.User);
        setConstructorOnPrototype(realmConstructor.Sync.Session);

        // A configuration for a default Realm
        realmConstructor.automaticSyncConfiguration = function(this: typeof Realm, user?: Realm.Sync.User) {
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

            let config = {
                sync: {
                    user: user,
                    url: realmUrl,
                }
            };
            return config;
        };

        realmConstructor.Sync.openLocalRealmBehavior = {
            type: 'openImmediately'
        };

        realmConstructor.Sync.downloadBeforeOpenBehavior = {
            type: 'downloadBeforeOpen',
            timeOut: 30 * 1000,
            timeOutBehavior: 'throwException'
        };

        realmConstructor.Sync.setFeatureToken = function() {
            console.log('Realm.Sync.setFeatureToken() is deprecated and you can remove any calls to it.');
        };

        // TODO: Update session prototype with mixins
        // realmConstructor.Sync.Session.prototype.uploadAllLocalChanges = ;

        // realmConstructor.Sync.Session.prototype.downloadAllServerChanges = function(timeout) ;

        // Keep these value in sync with subscription_state.hpp
        realmConstructor.Sync.SubscriptionState = {
            Error: -1,      // An error occurred while creating or processing the partial sync subscription.
            Creating: 2,    // The subscription is being created.
            Pending: 0,     // The subscription was created, but has not yet been processed by the sync server.
            Complete: 1,    // The subscription has been processed by the sync server and data is being synced to the device.
            Invalidated: 3, // The subscription has been removed.
        };

        realmConstructor.Sync.ConnectionState = {
            Disconnected: "disconnected",
            Connecting: "connecting",
            Connected: "connected",
        };

        // Define the permission schemas as constructors so that they can be
        // passed into directly to functions which want object type names
        const Permission = function() {};
        Permission.schema = Object.freeze({
            name: '__Permission',
            properties: {
                role: '__Role',
                canRead: {type: 'bool', default: false},
                canUpdate: {type: 'bool', default: false},
                canDelete: {type: 'bool', default: false},
                canSetPermissions: {type: 'bool', default: false},
                canQuery: {type: 'bool', default: false},
                canCreate: {type: 'bool', default: false},
                canModifySchema: {type: 'bool', default: false},
            }
        });

        const User = function() {};
        User.schema = Object.freeze(<const>{
            name: '__User',
            primaryKey: 'id',
            properties: {
                id: 'string',
                role: '__Role'
            }
        });

        const Role = function() {};
        Role.schema = Object.freeze(<const>{
            name: '__Role',
            primaryKey: 'name',
            properties: {
                name: 'string',
                members: '__User[]'
            }
        });

        const Class = function() {};
        Class.schema = Object.freeze(<const>{
            name: '__Class',
            primaryKey: 'name',
            properties: {
                name: 'string',
                permissions: '__Permission[]'
            }
        });
        Class.prototype.findOrCreate = function(roleName) {
            return findOrCreatePermissionForRole(this, this.permissions, roleName);
        };

        const Realm: typeof Realm = function() {};
        Realm.schema = Object.freeze(<const>{
            name: '__Realm',
            primaryKey: 'id',
            properties: {
                id: 'int',
                permissions: '__Permission[]'
            }
        });
        Realm.prototype.findOrCreate = function(roleName) {
            return findOrCreatePermissionForRole(this, this.permissions, roleName);
        };

        const permissionsSchema = {
            'Class': Class,
            'Permission': Permission,
            'Realm': Realm,
            'Role': Role,
            'User': User,
        };

        if (!realmConstructor.Permissions) {
            Object.defineProperty(realmConstructor, 'Permissions', {
                value: permissionsSchema,
                configurable: false
            });
        }

        const ResultSets = function() {};
        ResultSets.schema = Object.freeze({
            name: '__ResultSets',
            properties: {
                _name: { type: 'string', indexed: true, mapTo: 'name' },
                _query: {type: 'string', mapTo: 'query'},
                _matchesProperty: {type: 'string', mapTo: 'matches_property'},
                _queryParseCounter: {type: 'int',  mapTo: 'query_parse_counter'},
                _state: {type: 'int', mapTo: 'status'},
                _errorMessage: { type: 'string', mapTo: 'error_message'},
                _createdAt: { type: 'date', mapTo: 'created_at'},
                _updatedAt: { type: 'date', mapTo: 'updated_at'},
                _expiresAt: { type: 'date', optional: true, mapTo: 'expires_at'},
                _timeToLive: { type: 'int', optional: true, mapTo: 'time_to_live'},
            }
        });
        ResultSets.prototype._subscriptionUpdated = function(sub) {
            this._updatedAt = new Date();
            this._expiresAt = new Date(sub._updatedAt.getTime() + sub._timeToLive);
        };
        Object.defineProperties(ResultSets.prototype, {
            objectType: {
                enumerable: true,
                get: function() {
                    return this._matchesProperty.replace(subscriptionObjectNameRegex, '$2');
                }
            },
            name: {
                enumerable: true,
                get: function() {
                    return this._name;
                }
            },
            query: {
                enumerable: true,
                set: function(val) {
                    if (typeof val === 'string' || val instanceof String) {
                        this._query = val;
                    } else {
                        const queryDescription = val.description();
                        if (queryDescription === undefined) {
                            throw new Error("Updating a query must be done either using a String or a Results object.");
                        }
                        this._query = queryDescription;
                    }
                    this._errorMessage = '';
                    this._state = 0;
                    this._subscriptionUpdated(this);
                },
                get: function() {
                    return this._query;
                }
            },
            state: {
                enumerable: true,
                get: function() {
                    return this._state;
                }
            },
            error: {
                enumerable: true,
                get: function() {
                    return (this._errorMessage === '') ? undefined : this._errorMessage;
                }
            },
            createdAt: {
                enumerable: true,
                get: function() {
                    return this._createdAt;
                }
            },
            updatedAt: {
                enumerable: true,
                get: function() {
                    return this._updatedAt;
                }
            },
            expiresAt: {
                enumerable: true,
                get: function() {
                    return this._expiresAt;
                }
            },
            timeToLive: {
                enumerable: true,
                set: function(val) {
                    this._timeToLive = val;
                    this._subscriptionUpdated(this);
                },
                get: function() {
                    return this._timeToLive;
                }
            }
        });

        const subscriptionSchema = {
            'ResultSets': ResultSets
        };

        if (!realmConstructor.Subscription) {
            Object.defineProperty(realmConstructor, 'Subscription', {
                value: subscriptionSchema,
                configurable: false,
            });
        }

        // Add instance methods to the Realm object that are only applied if Sync is
        Object.defineProperties(realmConstructor.prototype, getOwnPropertyDescriptors({
            permissions(arg) {
                if (!this._isPartialRealm) {
                    throw new Error("Wrong Realm type. 'permissions()' is only available for Query-based Realms.");
                }
                // If no argument is provided, return the Realm-level permissions
                if (arg === undefined) {
                    return this.objects('__Realm').filtered(`id = 0`)[0];
                } else {
                    // Else try to find the corresponding Class-level permissions
                    let schemaName = this._schemaName(arg);
                    let classPermissions = this.objects('__Class').filtered(`name = '${schemaName}'`);
                    if (classPermissions.length === 0) {
                        throw Error(`Could not find Class-level permissions for '${schemaName}'`);
                    }
                    return classPermissions[0];
                }
            },

            subscriptions(name) {
                if (!this._isPartialRealm) {
                    throw new Error("Wrong Realm type. 'subscriptions()' is only available for Query-based Realms.");
                }
                let allSubscriptions = this.objects('__ResultSets');
                if (name) {
                    if (typeof(name) !== 'string') {
                        throw new Error(`string expected - got ${typeof(name)}.`);
                    }
                    if (name.includes('*') || name.includes('?')) {
                        allSubscriptions = allSubscriptions.filtered(`name LIKE '${name}'`);
                    } else {
                        allSubscriptions = allSubscriptions.filtered(`name == '${name}'`);
                    }
                }
                return allSubscriptions;
            },

            unsubscribe(name) {
                if (!this._isPartialRealm) {
                    throw new Error("Wrong Realm type. 'unsubscribe()' is only available for Query-based Realms.");
                }
                if (typeof(name) === 'string') {
                    if (name !== '') {
                        let named_subscriptions = this.objects('__ResultSets').filtered(`name == '${name}'`);
                        if (named_subscriptions.length === 0) {
                            return;
                        }
                        let doCommit = false;
                        if (!this.isInTransaction) {
                            this.beginTransaction();
                            doCommit = true;
                        }
                        this.delete(named_subscriptions);
                        if (doCommit) {
                            this.commitTransaction();
                        }
                    } else {
                        throw new Error('Non-empty string expected.');
                    }
                } else {
                    throw new Error(`string expected - got ${typeof(name)}.`);
                }
            }
        }));

        Object.defineProperties(realmConstructor, getOwnPropertyDescriptors({
            _extendQueryBasedSchema(schema) {
                addSchemaIfNeeded(schema, realmConstructor.Permissions.Class);
                addSchemaIfNeeded(schema, realmConstructor.Permissions.Permission);
                addSchemaIfNeeded(schema, realmConstructor.Permissions.Realm);
                addSchemaIfNeeded(schema, realmConstructor.Permissions.Role);
                addSchemaIfNeeded(schema, realmConstructor.Permissions.User);
                addSchemaIfNeeded(schema, realmConstructor.Subscription.ResultSets);
            },

            // Creates the user agent description for the JS binding itself. Users must specify the application
            // user agent using Realm.Sync.setUserAgent(...)
            _createUserAgentDescription() {
                // Detect if in ReactNative (running on a phone) or in a Node.js environment
                // Credit: https://stackoverflow.com/questions/39468022/how-do-i-know-if-my-code-is-running-as-react-native
                try {
                    var userAgent = "RealmJS/";
                    userAgent = userAgent + require('../package.json').version + " (" + context + ", ";
                    if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
                        // Running on ReactNative
                        const Platform = require('react-native').Platform;
                        userAgent += Platform.OS + ", v" + Platform.Version;
                    } else {
                        // Running on a normal machine
                        userAgent += process.version;
                    }
                    return userAgent += ")";
                } catch (e) {
                    return "RealmJS/Unknown"
                }
            },
        }));
    }

    // TODO: Remove this now useless object.
    var types = Object.freeze({
        'BOOL': 'bool',
        'INT': 'int',
        'FLOAT': 'float',
        'DOUBLE': 'double',
        'STRING': 'string',
        'DATE': 'date',
        'DATA': 'data',
        'OBJECT': 'object',
        'LIST': 'list',
    });
    Object.defineProperty(realmConstructor, 'Types', {
        get: function() {
            if (typeof console != 'undefined') {
                /* global console */
                /* eslint-disable no-console */
                var stack = new Error().stack.split("\n").slice(2).join("\n");
                var msg = '`Realm.Types` is deprecated! Please specify the type name as lowercase string instead!\n'+stack;
                if (console.warn != undefined) {
                    console.warn(msg);
                }
                else {
                    console.log(msg);
                }
                /* eslint-enable no-console */
            }
            return types;
        },
        configurable: true
    });
}

export = LoadExtensions;