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

'use strict';

const arrayPrototype = Array.prototype;

// eslint-disable-next-line no-undef
interface IteratorType { value(): this; }
interface IterableType { [Symbol.iterator]: IteratorType; }
const iteratorPrototype: IterableType = {} as any;

// These iterators should themselves be iterable.
Object.defineProperty(iteratorPrototype, Symbol.iterator, {
    value: function() {
        return this;
    }
});

const arrayMethods = <const>[
    'toString',
    'toLocaleString',
    'concat',
    'join',
    'slice',
    'lastIndexOf',
    'every',
    'some',
    'forEach',
    'find',
    'findIndex',
    'map',
    'filter',
    'reduce',
    'reduceRight',
];
type arrayMethods = typeof arrayMethods[number];

const iteratorMethods = <const>['entries', 'keys', 'values'];
type iteratorMethods = typeof iteratorMethods[number];

interface DescriptorFor<ArrayType, P extends keyof any[]> extends PropertyDescriptor {
    value: (ArrayType[])[P];
    configurable: true;
    writable: true;
}
type MethodsFromArray<K extends keyof any[], ArrayType> = {
    [P in K]: DescriptorFor<ArrayType, P>;
};

type CollectionMethods<T = any> = MethodsFromArray<arrayMethods | iteratorMethods, T> & {
    [Symbol.iterator]: {value: T[]['values'], configurable: true, writable: true};
};

const CollectionMethods: CollectionMethods = {} as any;

const a = CollectionMethods[Symbol.iterator];
for (let methodName of arrayMethods) {
    var method: (any[])[typeof methodName] = arrayPrototype[methodName];
    if (method) {
        CollectionMethods[methodName] = {value: method, configurable: true, writable: true} as any;
    }
}

for (let methodName of iteratorMethods) {
    const method = function<T>(this: RealmTypes.Collection<T>) {
        var self = this.snapshot();
        var index = 0;

        return Object.create(iteratorPrototype, {
            next: {
                value() {
                    if (!self || index >= self.length) {
                        self = null;
                        return {done: true, value: undefined};
                    }

                    var value: any;
                    switch (methodName) {
                        case 'entries':
                            value = [index, self[index]];
                            break;
                        case 'keys':
                            value = index;
                            break;
                        default:
                            value = self[index];
                    }

                    index++;
                    return {done: false, value: value};
                }
            }
        });
    };

    CollectionMethods[methodName] = {value: method, configurable: true, writable: true};
}
CollectionMethods[Symbol.iterator] = CollectionMethods.values;

export = CollectionMethods;
