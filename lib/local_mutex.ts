export class LocalMutex {
    locks: {
        [key: string]: {
            isLocked: boolean;
            queue: Array<() => void>;
            timeoutId?: any
        }
    } = {};

    private readonly timeout: number

    constructor(timeout: number = 0) {
        this.timeout = timeout
    }

    async withLock<T>(name: string, block: () => Promise<T>): Promise<T> {
        const unlocker = await this.lock(name)
        try {
            const result: T = await block()
            unlocker()
            return Promise.resolve(result)
        } catch (e) {
            unlocker()
            return Promise.reject(e)
        }
    }

    lock(name: string): Promise<() => void> {
        return new Promise<() => void>((resolve) => {
            if (!this.locks[name]) {
                this.locks[name] = {isLocked: false, queue: []};
            }

            const lock = this.locks[name];
            let unlockerInvoked = false
            const unlocker = () => {
                if (unlockerInvoked) {
                    return
                }
                unlockerInvoked = true

                if (lock.timeoutId) {
                    clearTimeout(lock.timeoutId);
                }

                if (lock.queue.length > 0) {
                    const nextResolve = lock.queue.shift();
                    if (nextResolve != undefined) {
                        nextResolve();
                    }
                } else {
                    lock.isLocked = false;
                    if (!lock.isLocked && lock.queue.length === 0) {
                        delete this.locks[name];  // Clean up the lock if it's not locked and the queue is empty
                    }
                }
            }

            const resolveUnlock = () => {
                if (this.timeout > 0) {
                    lock.timeoutId = setTimeout(() => {
                        unlocker()
                    }, this.timeout);
                }
                resolve(unlocker);
            }

            if (!lock.isLocked) {
                lock.isLocked = true;
                resolveUnlock()
            } else {
                lock.queue.push(() => {
                    resolveUnlock()
                });
            }
        });
    }
}
