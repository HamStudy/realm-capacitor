
import {Realm} from './Realm';
import { Results } from './Collections';
import { TypeOfUserTypeProperty, PropertyUserType, TypeOfSchema, ObjectSchema, UserObjectSchema } from './Schema';

// object props type
export interface ObjectPropsType {
    [keys: string]: any;
}

export interface ObjectChangeSet<SchemaType extends ObjectSchema> {
    deleted: boolean;
    changedProperties: (keyof SchemaType['properties'])[]
}

export type ObjectChangeCallback<SchemaType extends ObjectSchema> =
    (object: RealmObject<SchemaType>, changes: ObjectChangeSet<SchemaType>) => void;


/**
 * Object
 * @see { @link https://realm.io/docs/javascript/latest/api/Realm.Object.html }
 */
type RealmObject<SchemaType extends ObjectSchema, BaseType extends object = TypeOfSchema<SchemaType>>
    = RealmUntypedObject<SchemaType> & BaseType;
interface RealmUntypedObject<SchemaType extends ObjectSchema> {
    /**
     * @returns boolean
     */
    isValid(): boolean;

    /**
     * @returns ObjectSchema
     */
    objectSchema(): SchemaType;

    /**
     * @returns Results<T>
     */
    linkingObjects<T extends PropertyUserType>(objectType: T, property: keyof TypeOfUserTypeProperty<T>): Results<RealmObject<any, TypeOfUserTypeProperty<T>>>;

    /**
     * @returns number
     */
    linkingObjectsCount(): number;

    objectId(): string;

    /**
     * @returns void
     */
    addListener(callback: ObjectChangeCallback<SchemaType>): void;

    removeListener(callback: ObjectChangeCallback<SchemaType>): void;

    removeAllListeners(): void;
}
interface RealmObjectConstructor {
    prototype: any;
}
declare const RealmObject: RealmObjectConstructor;

export {RealmObject as Object};
