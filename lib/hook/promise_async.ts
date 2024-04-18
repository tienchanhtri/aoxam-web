import {useEffect, useRef, useState} from "react";
import {Async, Fail, Loading, Success, Uninitialized} from "@/lib/async";
import {from, Observable, Subscription} from "rxjs";

export function executePromise<T>(
    promise: Promise<T>,
    onAsync: ((async: Async<T>) => void),
): Subscription {
    onAsync(new Loading<T>(null))
    return from(promise)
        .subscribe({
            next: (value) => onAsync(new Success(value)),
            error: (error) => onAsync(new Fail<T>(error, null)),
        })
}

export function executeStream<T>(
    stream: Observable<T>,
    onAsync: ((async: Async<T>) => void),
): Subscription {
    onAsync(new Loading<T>(null))
    return stream.subscribe({
        next: (value) => onAsync(new Success(value)),
        error: (error) => onAsync(new Fail<T>(error, null)),
    })
}

export function usePromiseAsync<T>(promiseFactory: () => Promise<T>) {
    const [async, setAsync] = useState<Async<T>>(new Uninitialized())
    const sub = useRef<Subscription | undefined>(undefined)
    const refresh: () => void = () => {
        sub.current?.unsubscribe()
        setAsync(new Loading(async.invoke()))
        sub.current = from(promiseFactory())
            .subscribe(
                {
                    next: (value) => setAsync(new Success(value)),
                    error: (error) => setAsync(new Fail(error, async.invoke())),
                }
            )
    }
    useEffect(() => {
        refresh()
        return () => {
            sub.current?.unsubscribe()
        }
    }, [])
    return [async, setAsync, sub, refresh] as const;

}