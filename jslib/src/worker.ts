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

const require_method = require;

// Prevent React Native packager from seeing modules required with this
function nodeRequire<ModType>(module: string) : ModType {
    return require_method(module);
}

// We import these in a way that they won't actually include code, only types
import * as cpType from 'child_process';
import * as osType from 'os';

const cp: typeof cpType = nodeRequire('child_process');
const os: typeof osType = nodeRequire('os');

interface WorkerOptions {
    maxWorkers?: number;
    env?: NodeJS.ProcessEnv;
    execArgv?: string[];
}
class Worker {
    maxWorkers = this.options.maxWorkers || os.cpus().length
    env = this.options.env || {};
    execArgv = this.options.execArgv || [];

    private _stopping = false;
    /** Called to indicate shutdown is complete */
    private _shutdownComplete?: (...args: any[]) => any;

    private _workers = [] as any[];
    private _waiting = [] as cpType.ChildProcess[];
    private _workQueue = [] as any[];
    private _changeObjects = {} as any;
    private firstWorker = this._startWorker();

    constructor(private modulePath: string, private options: WorkerOptions = {}) {
    }

    onavailable(path: string) {
        if (!this._stopping) {
            this._push({message: 'available', path});
        }
    }

    ondelete(change: any) {
        if (this._stopping) {
            change.release();
            return;
        }

        const serialized = change.serialize();
        change.refCount = (change.refCount || 0) + 1;
        this._changeObjects[serialized] = change;
        this._push({message: 'delete', change: serialized});
    }

    onchange(change: any) {
        if (this._stopping) {
            change.release();
            return;
        }

        const serialized = change.serialize();
        change.refCount = (change.refCount || 0) + 1;
        this._changeObjects[serialized] = change;
        this._push({message: 'change', change: serialized});
    }

    stop() {
        this._stopping = true;
        return new Promise((r) => {
            this._shutdownComplete = r;
            this._next();
        });
    }

    _push(message: any) {
        this._workQueue.push(message);
        this._next();
    }

    _startWorker() {
        const child = cp.fork(__dirname + '/notification-worker.js', [], {
            env: this.env,
            execArgv: this.execArgv
        });
        let promise = new Promise<cpType.ChildProcess>(r => { (<any>child).resolveStartup = r; });
        child.on('message', (m: any) => {
            if (m.change) {
                const changeObj = this._changeObjects[m.change];
                delete this._changeObjects[m.change];
                changeObj.release();
            }
            (<any>child).resolveStartup();
            this._waiting.push(child);
            this._next();
        });
        child.on('exit', (code, signal) => {
            if (code !== 0) {
                console.error(`Unexpected exit code from child: ${code} ${signal}`);
            }
            this._workers = this._workers.filter(c => c !== child);
            this._next();
        });
        child.send({message: 'load', module: this.modulePath});
        this._workers.push(child);
        return promise;
    }

    _next() {
        if (this._stopping && this._workQueue.length === 0) {
            for (const worker of this._workers) {
                if (!worker.stopping) {
                    worker.send({message: 'stop'});
                    worker.stopping = true;
                }
            }
            if (this._workers.length === 0) {
                this._shutdownComplete();
            }
            return;
        }
        if (this._workQueue.length === 0) {
            return;
        }
        if (this._waiting.length === 0) {
            if (this._workers.length < this.maxWorkers && this._workers.length < this._workQueue.length) {
                this._startWorker();
            }
            return;
        }
        const worker = this._waiting.shift();
        const message = this._workQueue.shift();
        worker.send(message);
    }
}

export { Worker };
