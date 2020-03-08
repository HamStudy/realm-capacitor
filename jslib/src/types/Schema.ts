
import { List, Results } from './Collections';

declare namespace RealmUser {
    /**
     * Augment this interface in your project to add new object types to be
     * supported by the realm types
     */
    interface ObjectTypes {
        // For example:
        '__ResultSets': {_name: string, _query: string, _matchesProperty: string};
    }
}

/**
 * PropertyType
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~PropertyType }
 */
export type PropertyNonIndexableTypes = 'float' | 'double' | 'data' | 'date';
export type PropertyIndexableTypes = 'bool' | 'int' | 'string';
export type PropertyPrimitiveTypes = PropertyNonIndexableTypes | PropertyIndexableTypes;
export type PropertyListType = 'list';
export type PropertyLinkingType = 'linkingObjects';
export type UserTypeInterface = RealmUser.ObjectTypes;
export type PropertyUserType = keyof UserTypeInterface;
export type PropertyType = 
    PropertyPrimitiveTypes  // things we treat as primitives (including data and date)
    | PropertyLinkingType   // the 'linkingObjects' type
    | PropertyListType      // the 'list' type
    | PropertyUserType;     // User-defined object types

export type TypeOfPrimitiveProperty<T extends PropertyPrimitiveTypes> = 
    T extends 'float' | 'double' | 'int' ? number :
    T extends 'string' ? string :
    T extends 'data' ? ArrayBuffer :
    T extends 'date' ? Date :
    T extends 'bool' ? boolean :
    never;

/** 
 * Used to get the type from the user-defined type string
 *  - Add new types by defining them (with the appropriate interface)
 *    in an augmentation of RealmUser.ObjectTypes
*/
export type TypeOfUserTypeProperty<T extends PropertyUserType> = UserTypeInterface[T];
export type TypeOfListTypeProperty<T extends PropertyType> = List<TypeOfProperty<T>>;
export type TypeOfLinkingTypeProperty<T extends PropertyType> = Readonly<Results<Readonly<TypeOfProperty<T>>>>;

export type TypeOfPropertyString<T extends PropertyType> = 
    T extends PropertyPrimitiveTypes ? TypeOfPrimitiveProperty<T> :
    T extends PropertyUserType ? TypeOfUserTypeProperty<T> :
    T extends PropertyLinkingType ? TypeOfLinkingTypeProperty<T> :
    T extends PropertyListType ? TypeOfListTypeProperty<T> :
    any;
export type TypeOfProperty<T extends PropertyType | ObjectSchemaProperty> =
    T extends PropertyType ? TypeOfPropertyString<T> :
    T extends ObjectSchemaProperty ? TypeOfPropertyString<T['type']>
    : any;

export type GetRequired<T extends PropertiesTypes> = {
    [K in keyof T]:
        [T] extends [Record<K, T[K]>] ?
            T[K] extends string ? K :
            T[K] extends {optional: false} ? K
        : never : never;
}[keyof T];
export type GetNotRequired<T extends PropertiesTypes> = Exclude<keyof T, GetRequired<T>>;

export type TypeOfSchema<Schema extends ObjectSchema<PropertyType>> = {
    [K in GetRequired<Schema['properties']>]: TypeOfProperty<Schema['properties'][K]>
} & {
    [K in GetNotRequired<Schema['properties']>]?: TypeOfProperty<Schema['properties'][K]>
};

/**
 * This includes fields common to all property types
 */
export interface ObjectSchemaBaseProperty<T extends PropertyType> {
    type: T;
    optional?: boolean;
    mapTo?: string;
}

/**
 * linkingObject properties
 * 
 * Property is read-only and always returns a Realm.Results of all the objects
 * matching the objectType that are linking to the current object through the property relationship specified in ObjectSchemaProperty.
 */
export interface ObjectSchemaLinkTypeProperty<ObjectType extends PropertyUserType>
                            extends ObjectSchemaBaseProperty<PropertyLinkingType> {
    objectType?: ObjectType;
    property?: keyof TypeOfUserTypeProperty<ObjectType>;
    default?: TypeOfUserTypeProperty<ObjectType>;
    /** Indexing linkingObjects type fields is not supported */
    indexed?: false;
}
export interface ObjectSchemaListTypeProperty<ListType extends PropertyType>
                            extends ObjectSchemaBaseProperty<PropertyListType> {
    objectType?: ListType;
    // default?: any; // TODO: Is this applicable to list types?
    /** Indexing list fields is not supported */
    indexed?: false;
}
export interface ObjectSchemaPrimitivePropertyBase<T extends PropertyPrimitiveTypes>
                                extends ObjectSchemaBaseProperty<T> {
    default?: TypeOfPrimitiveProperty<T>;
    mapTo?: string;
}
export interface ObjectSchemaIndexableProperty<T extends PropertyIndexableTypes>
                                extends ObjectSchemaPrimitivePropertyBase<T> {
    indexed?: boolean;
}
export interface ObjectSchemaNonIndexableProperty<T extends PropertyNonIndexableTypes>
                                extends ObjectSchemaPrimitivePropertyBase<T> {
    indexed?: false;
}
export interface ObjectSchemaUserTypeProperty<T extends PropertyUserType>
                                extends ObjectSchemaBaseProperty<T> {
    default?: TypeOfUserTypeProperty<T>;
    mapTo?: string;
    indexed?: false;
}

/**
 * ObjectSchemaProperty
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~ObjectSchemaProperty }
 */
export type ObjectSchemaProperty = 
    ObjectSchemaIndexableProperty<PropertyIndexableTypes>
    | ObjectSchemaNonIndexableProperty<PropertyNonIndexableTypes>
    | ObjectSchemaListTypeProperty<PropertyType>
    | ObjectSchemaUserTypeProperty<PropertyUserType>
;
// properties types
export interface PropertiesTypes<PType extends PropertyType = PropertyType> {
    [keys: string]: (PropertyType & PType) | (ObjectSchemaProperty & {type: PType});
}

/**
 * ObjectSchema
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~ObjectSchema }
 */
export interface ObjectSchema<PType extends PropertyType = PropertyType> {
    name: string;
    primaryKey?: keyof this['properties'];
    properties: PropertiesTypes<PType>;
}
export type UserObjectSchema = ObjectSchema<PropertyUserType>;

/**
 * ObjectClass
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~ObjectClass }
 */
export interface ObjectClass {
    schema: ObjectSchema;
}

/**
 * ObjectType
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.html#~ObjectType }
 */
export interface ObjectType {
    type: ObjectClass;
}
