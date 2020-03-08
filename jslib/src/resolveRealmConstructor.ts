
import { Realm } from './types/Realm';

export function getRealmConstructor() { return realmConstructor; }
export function setRealmConstructor(c: typeof Realm) {
    realmConstructor = c;
}
export var realmConstructor: typeof Realm;
