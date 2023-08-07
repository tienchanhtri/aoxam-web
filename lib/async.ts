import {isLocalMachine, sleep} from "@/lib/utils";

export class Async<T> {
    complete: boolean
    shouldLoad: boolean
    value: T | null

    constructor(complete: boolean, shouldLoad: boolean, value: T | null) {
        this.complete = complete
        this.shouldLoad = shouldLoad
        this.value = value
    }

    invoke(): T | null {
        return this.value
    }

    isUninitialized(): this is Uninitialized<T> {
        return !this.complete && this.shouldLoad
    }

    isLoading(): this is Loading<T> {
        return !this.complete && !this.shouldLoad
    }

    isSucceed(): this is Success<T> {
        return this.complete && !this.shouldLoad
    }

    isFail(): this is Fail<T> {
        return this.complete && this.shouldLoad
    }
}

export class Uninitialized<T> extends Async<T> {
    constructor() {
        super(false, true, null);
    }
}

export class Loading<T> extends Async<T> {
    constructor(value: T | null) {
        super(false, false, value);
    }
}

export class Success<T> extends Async<T> {
    value: T

    constructor(value: T) {
        super(true, false, value);
        this.value = value
    }

    invoke(): T {
        return this.value
    }
}

export class Fail<T> extends Async<T> {
    error: Error

    constructor(error: Error, value: T | null) {
        super(true, true, value);
        this.error = error
    }
}

function test(async: Async<string>) {
    if (async.isUninitialized()) {
        const v: String | null = async.invoke()
    }
    if (async.isLoading()) {
        const v: String | null = async.invoke()
    }

    if (async.isSucceed()) {
        const v: String = async.invoke()
    }

    if (async.isFail()) {
        const v: String | null = async.invoke()
        const e = async.error
    }
}

declare global {
    interface Promise<T> {
        onAsync<T>(onAsync: (async: Async<T>) => void): Promise<T>

        execute<T>(
            abortController: AbortController | null,
            retainValue: T | null,
            onAsync: (async: Async<T>) => void,
        ): void

        delayInLocal<T>(ms: number): Promise<T>

        abortWith(
            controller: AbortController | null,
        ): Promise<T>

        ignoreAbortError(): void
    }
}

Promise.prototype.execute = function <T>(
    abortController: AbortController | null,
    retainValue: T | null,
    onAsync: (async: Async<T>) => void,
) {
    function isAborted(): boolean {
        return abortController?.signal?.aborted == true
    }

    if (isAborted()) {
        return
    }
    onAsync(new Loading<T>(retainValue))
    this
        .then((result) => {
            if (isAborted()) {
                return
            }
            onAsync(new Success<T>(result))
        })
        .catch((error) => {
            if (isAborted()) {
                return
            }
            if (error instanceof AbortError) {
                return
            }
            onAsync(new Fail<T>(error, retainValue))
        })
}

export class AbortError extends Error {
    constructor() {
        super("Aborted");
        Object.setPrototypeOf(this, AbortError.prototype);
    }
}

Promise.prototype.abortWith = function <T>(controller: AbortController | null): Promise<T> {
    if (controller == null) {
        return this
    }
    return this.then((value) => {
        if (controller.signal.aborted) {
            return Promise.reject(new AbortError())
        }
        return Promise.resolve(value)
    })
}

Promise.prototype.ignoreAbortError = function <T>(): void {
    this.catch((error) => {
        if (!(error instanceof AbortError)) {
            throw error
        }
    })
}

Promise.prototype.onAsync = function <T>(onAsync: (async: Async<T>) => void): Promise<T> {
    onAsync(new Loading<T>(null))
    return this.then((value) => {
        onAsync(new Success<T>(value))
        return value
    }).catch((error) => {
        onAsync(new Fail<T>(error, null))
        return error
    })
}

Promise.prototype.delayInLocal = function <T>(ms: number): Promise<T> {
    if (!isLocalMachine()) {
        return this
    }
    return this.then((v) => {
        return sleep(ms).then(() => v)
    }).catch((e) => {
        return sleep(ms).then(() => Promise.reject(e))
    })
}


export {};