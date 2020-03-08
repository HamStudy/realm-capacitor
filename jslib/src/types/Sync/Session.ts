import { User } from "./User";
import { AuthError } from "../../errors";
import { waitForCompletion } from "../../extensions";


export interface SyncError {
    name: string;
    message: string;
    isFatal: boolean;
    category?: string;
    code: number;
}

export interface SSLVerifyObject {
    serverAddress: string;
    serverPort: number;
    pemCertificate: string;
    acceptedByOpenSSL: boolean;
    depth: number;
}

export type ErrorCallback = (session: Session, error: SyncError | AuthError) => void;
export type SSLVerifyCallback = (sslVerifyObject: SSLVerifyObject) => boolean;
export const enum SessionStopPolicy {
    AfterUpload = "after-upload",
    Immediately = "immediately",
    Never = "never"
}

export interface SSLConfiguration {
    validate?: boolean;
    certificatePath?: string;
    validateCallback?: SSLVerifyCallback;
}

export const enum ClientResyncMode {
    Discard = 'discard',
    Manual = 'manual',
    Recover = 'recover'
}

export interface SyncConfiguration {
    user: User;
    url: string;
    /** @deprecated use `ssl` instead */
    validate_ssl?: boolean;
    /** @deprecated use `ssl` instead */
    ssl_trust_certificate_path?: string;
    /** @deprecated use `ssl` instead */
    open_ssl_verify_callback?: SSLVerifyCallback;
    ssl?: SSLConfiguration;
    error?: ErrorCallback;
    partial?: boolean;
    fullSynchronization?: boolean;
    _disableQueryBasedSyncUrlChecks?: boolean;
    _sessionStopPolicy?: SessionStopPolicy;
    custom_http_headers?: { [header: string]: string };
    customQueryBasedSyncIdentifier?: string;
    newRealmFileBehavior?: OpenRealmBehaviorConfiguration;
    existingRealmFileBehavior?: OpenRealmBehaviorConfiguration;
    clientResyncMode?: ClientResyncMode;
}

export interface OpenRealmBehaviorConfiguration {
    readonly type: OpenRealmBehaviorType
    readonly timeOut?: number;
    readonly timeOutBehavior?: OpenRealmTimeOutBehavior;
}

export const enum OpenRealmBehaviorType {
    DownloadBeforeOpen = 'downloadBeforeOpen',
    OpenImmediately = "openImmediately"
}

export const enum OpenRealmTimeOutBehavior {
    OpenLocalRealm = 'openLocalRealm',
    ThrowException = 'throwException'
}

export let openLocalRealmBehavior: OpenRealmBehaviorConfiguration;
export let downloadBeforeOpenBehavior: OpenRealmBehaviorConfiguration;

export enum ConnectionState {
    Disconnected = "disconnected",
    Connecting = "connecting",
    Connected = "connected",
}

export type ProgressNotificationCallback = (transferred: number, transferable: number) => void;
export type ProgressDirection = 'download' | 'upload';
export type ProgressMode = 'reportIndefinitely' | 'forCurrentlyOutstandingWork';

export type ConnectionNotificationCallback = (newState: ConnectionState, oldState: ConnectionState) => void;

/**
* Session
* @see { @link https://realm.io/docs/javascript/latest/api/Realm.Sync.Session.html }
*/
export abstract class Session {
    readonly config: SyncConfiguration;
    readonly state: 'invalid' | 'active' | 'inactive';
    readonly url: string;
    readonly user: User;
    readonly connectionState: ConnectionState;

    abstract addProgressNotification(direction: ProgressDirection, mode: ProgressMode, progressCallback: ProgressNotificationCallback): void;
    abstract removeProgressNotification(progressCallback: ProgressNotificationCallback): void;

    abstract addConnectionNotification(callback: ConnectionNotificationCallback): void;
    abstract removeConnectionNotification(callback: ConnectionNotificationCallback): void;

    abstract isConnected(): boolean;

    abstract resume(): void;
    abstract pause(): void;

    downloadAllServerChanges(timeoutMs?: number): Promise<void> {
        return waitForCompletion(this, this._waitForDownloadCompletion, timeoutMs, `Downloading changes did not complete in ${timeoutMs} ms.`);
    } 
    uploadAllLocalChanges(timeoutMs?: number): Promise<void> {
        return waitForCompletion(this, this._waitForUploadCompletion, timeoutMs, `Uploading changes did not complete in ${timeoutMs} ms.`);
    }

    // Methods implemented in native code
    abstract _refreshAccessToken(accessToken: string, realmUrl: string, syncLabel?: string, urlPrefix?: string): void;
    abstract _waitForUploadCompletion(error?: Error): void;
    abstract _waitForDownloadCompletion(error?: Error): void;

}