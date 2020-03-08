
import {checkTypes} from '../../utils';

const IdentityProviders = <const>['password', 'facebook', 'google', 'anonymous', 'nickname', 'azuread', 'jwt', 'adminToken'];
type IdentityProviders = typeof IdentityProviders[number];

export {IdentityProviders};

export class Credentials {
    static usernamePassword(username: string, password: string, createUser?: boolean): Credentials {
        checkTypes(arguments, ['string', 'string', 'boolean']);
        return new this('password', username, { register: createUser, password });
    }

    static facebook(token: string): Credentials {
        checkTypes(arguments, ['string']);
        return new this('facebook', token);
    }

    static google(token: string): Credentials {
        checkTypes(arguments, ['string']);
        return new this('google', token);
    }

    static anonymous(): Credentials {
        return new this('anonymous');
    }

    static nickname(value: string, isAdmin?: boolean): Credentials {
        checkTypes(arguments, ['string', 'boolean']);
        return new this('nickname', value, { is_admin: isAdmin || false });
    }

    static azureAD(token: string): Credentials {
        checkTypes(arguments, ['string']);
        return new this('azuread', token)
    }

    static jwt(token: string, providerName?: string): Credentials {
        checkTypes(arguments, ['string', 'string']);
        return new this(providerName || 'jwt', token);
    }

    static adminToken(token: string): AdminCredentials {
        checkTypes(arguments, ['string']);
        return new AdminCredentials('adminToken', token);
    }

    static custom(providerName: string, token: string, userInfo?: { [key: string]: any }): Credentials {
        if (userInfo) {
            checkTypes(arguments, ['string', 'string', 'object']);
        } else {
            checkTypes(arguments, ['string', 'string']);
        }

        return new this(providerName, token, userInfo);
    }

    constructor(identityProvider: IdentityProviders, token?: string, userInfo?: { [key: string]: any });
    constructor(identityProvider: string, token?: string, userInfo?: { [key: string]: any });
    constructor(identityProvider: string, token?: string, userInfo?: { [key: string]: any }) {
        this.identityProvider = identityProvider;
        this.token = token;
        this.userInfo = userInfo;
    }
    
    readonly identityProvider: string;
    readonly token: string;
    readonly userInfo: { [key: string]: any };

    toJSON() {
        return {
            data: this.token,
            provider: this.identityProvider,
            user_info: this.userInfo,
        };
    }
}
export class AdminCredentials extends Credentials {
    readonly identityProvider: "adminToken";
}