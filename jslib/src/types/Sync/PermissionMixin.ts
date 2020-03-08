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

import { User as SyncUser } from "./User";
import { ObjectSchema } from "../Configuration";
import { Writeable } from "../../utils";

const accessLevels = <const>['none', 'read', 'write', 'admin'];
type AccessLevel = typeof accessLevels[number];
const offerAccessLevels = <const>['read', 'write', 'admin'];
type offerAccessLevels = typeof offerAccessLevels[number];

const validRecipients = <const>['currentUser', 'otherUser', 'any'];
type validRecipients = typeof validRecipients[number];

export {
    accessLevels, AccessLevel, offerAccessLevels, validRecipients
};

type UserInstance = {
    token: string;
    _performFetch: SyncUser['_performFetch'];
};

export class User {
    static schema: ObjectSchema;
    id: string;
}

export class Role {
    static schema: ObjectSchema;
    name: string;
    members: User[];
}

export class Permission {
    readonly id: string;
    readonly updatedAt: Date;
    readonly userId: string;
    readonly path: string;
    readonly mayRead?: boolean;
    readonly mayWrite?: boolean;
    readonly mayManage?: boolean;
}

export class PermissionOffer {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    statusCode?: number;
    statusMessage?: string;
    token?: string;
    realmUrl: string;
    mayRead?: boolean;
    mayWrite?: boolean;
    mayManage?: boolean;
    expiresAt?: Date;
}

interface _PermissionConditionUserId {
    userId: string
}

interface _PermissionConditionMetadata {
    metadataKey: string
    metadataValue: string
}

export type PermissionCondition = _PermissionConditionUserId | _PermissionConditionMetadata

export namespace Mixin {
  export function getGrantedPermissions(this: UserInstance, recipient: validRecipients) {
    if (recipient && validRecipients.indexOf(recipient) === -1) {
      return Promise.reject(new Error(`'${recipient}' is not a valid recipient type. Must be 'any', 'currentUser' or 'otherUser'.`));
    }

    const options = {
      method: 'GET',
      headers: { Authorization: this.token },
    };

    return this._performFetch<{permissions: Writeable<Permission>[]}>(`permissions?recipient=${recipient}`, options)
      .then((response) => {
        const permissions = response.permissions;
        // this is for backward compatibility
        for (const permission of permissions) {
          permission.mayRead = (<any>permission).accessLevel === 'read' || (<any>permission).accessLevel === 'write' || (<any>permission).accessLevel === 'admin';
          permission.mayWrite = (<any>permission).accessLevel === 'write' || (<any>permission).accessLevel === 'admin';
          permission.mayManage = (<any>permission).accessLevel === 'admin';
        }

        // Cast it back so it's read-only again
        return permissions as Permission[];
      });
  }

  export function applyPermissions(this: UserInstance, condition: PermissionCondition, realmUrl: string, accessLevel: AccessLevel) : Promise<void> {
    if (!realmUrl) {
      return Promise.reject(new Error('realmUrl must be specified'));
    }

    if (accessLevels.indexOf(accessLevel) === -1) {
      return Promise.reject(new Error(`'${accessLevel}' is not a valid access level. Must be ${accessLevels.join(', ')}.`));
    }

    const options = {
      method: 'POST',
      headers: { Authorization: this.token },
      body: {
        condition,
        realmPath: realmUrl,
        accessLevel: accessLevel.toLowerCase(),
      },
    };

    return this._performFetch<any>('permissions/apply', options);
  }

  export function offerPermissions(this: UserInstance, realmUrl: string, accessLevel: AccessLevel, expiresAt: Date) {
    if (!realmUrl) {
      return Promise.reject(new Error('realmUrl must be specified'));
    }

    if (offerAccessLevels.indexOf(accessLevel as offerAccessLevels) === -1) {
      return Promise.reject(new Error(`'${accessLevel}' is not a valid access level. Must be ${offerAccessLevels.join(', ')}.`));
    }

    const options = {
      method: 'POST',
      headers: { Authorization: this.token },
      body: {
        expiresAt,
        realmPath: realmUrl,
        accessLevel: accessLevel.toLowerCase(),
      },
    };

    return this._performFetch<{token: string}>('permissions/offers', options)
      .then((result) => {
        return result.token;
      });
  }

  export function acceptPermissionOffer(this: UserInstance, token: string) {
    if (!token) {
      return Promise.reject(new Error('Offer token must be specified'));
    }

    const options = {
      method: 'POST',
      headers: { Authorization: this.token },
    };

    return this._performFetch<{path: string}>(`permissions/offers/${token}/accept`, options)
      .then((result) => {
        return result.path;
      });
  }

  export function invalidatePermissionOffer(this: UserInstance, permissionOfferOrToken: PermissionOffer | string) {
    const options = {
      method: 'DELETE',
      headers: { Authorization: this.token },
    };

    let token = typeof permissionOfferOrToken === 'string' ? permissionOfferOrToken : permissionOfferOrToken.token;
    return this._performFetch<{path: string}>(`permissions/offers/${token}`, options)
      .then((result) => {
        return result.path;
      });
  }

  export function getPermissionOffers(this: UserInstance, ) {
    const options = {
      method: 'GET',
      headers: { Authorization: this.token },
    };

    return this._performFetch<{offers: PermissionOffer[]}>(`permissions/offers`, options)
      .then((result) => {
        return result.offers;
      });
  }
}
