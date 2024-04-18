import {GetServerSidePropsContext} from 'next';
import {deleteCookie, getCookie, setCookie} from 'cookies-next';
import {Observable} from "rxjs";

export function getStringUndefinedIfEmpty(key: string, target: any | undefined = undefined) {
    const result = getString(key, target)
    if (result) {
        return result
    }
    return undefined
}

export function getString(
    key: string,
    context: GetServerSidePropsContext | undefined = undefined
): string | undefined {
    if (context) {
        // If target is GetServerSidePropsContext, try to get from context.req.cookies
        const queryValue = context.query[key]
        if (Array.isArray(queryValue)) {
            return queryValue[0]
        }
        return queryValue ?? context.req.cookies[key] ?? undefined;
    } else {
        const cookieValue = getCookie(key)
        if (cookieValue != undefined) {
            return cookieValue;
        } else {
            return localStorage.getItem(key) ?? undefined;
        }
    }
}

export function getStringObservable(key: string): Observable<string | undefined> {
    return new Observable<string | undefined>((subscriber) => {
        const listener = (changedKey: string) => {
            if (changedKey == key) {
                let value = getString(key)
                if (!value) {
                    value = undefined
                }
                subscriber.next(value)
            }
        }
        const channel = newKvsReceiveChannel()
        channel.onmessage = (event) => {
            listener(event.data)
        };
        listeners.push(listener)
        listener(key)
        return () => {
            subscriber.complete()
            channel.close()
            removeListener(listener)
        }
    })
}

let kvsBroadcastChannel: BroadcastChannel

function getKvsSendChannel() {
    if (kvsBroadcastChannel == undefined) {
        kvsBroadcastChannel = new BroadcastChannel("ax_kvs")
    }
    return kvsBroadcastChannel
}

function newKvsReceiveChannel(): BroadcastChannel {
    return new BroadcastChannel("ax_kvs")
}

const listeners: ((key: string) => void)[] = []
const removeListener = (listener: (key: string) => void) => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
        listeners.splice(index, 1);
    }
};

function notifyKeyValueChanged(key: string) {
    listeners.forEach((listener) => {
        listener(key)
    })
    console.log(`notify channel ${key}`)
    getKvsSendChannel().postMessage(key)
}

export function setString(
    key: string,
    value: string,
    context: GetServerSidePropsContext | undefined = undefined
): void {
    if (context) {
        context.req.cookies[key] = value;
        const req = context.req
        const res = context.res
        setCookie(key, value, {req, res,})
    } else if (typeof window !== 'undefined') {
        // If not on server side, set the value in localStorage
        localStorage.setItem(key, value);
        setCookie(key, value)
        notifyKeyValueChanged(key)
    }
}

export function removeString(
    key: string,
    context: GetServerSidePropsContext | undefined = undefined
) {
    if (context) {
        delete context.req.cookies[key]
        const req = context.req
        const res = context.res
        deleteCookie(key, {req, res,})
    } else if (typeof window !== 'undefined') {
        // If not on server side, set the value in localStorage
        localStorage.removeItem(key);
        deleteCookie(key)
        notifyKeyValueChanged(key)
    }
}