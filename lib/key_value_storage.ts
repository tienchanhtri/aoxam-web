import {GetServerSidePropsContext} from 'next';

const cookie = require('cookie-cutter');

export function getString(key: string, target: any | undefined = undefined): string | undefined {
    if (isGetServerSidePropsContext(target)) {
        // If target is GetServerSidePropsContext, try to get from context.req.cookies
        const queryValue = target.query[key]
        if (Array.isArray(queryValue)) {
            return queryValue[0]
        }
        return queryValue ?? target.req.cookies[key] ?? undefined;
    } else if (typeof window !== 'undefined') {
        // If not on server side, try to get from localStorage, fallback to cookie
        const localStorageValue = localStorage.getItem(key);
        if (localStorageValue !== null) {
            return localStorageValue;
        } else {
            return cookie.get(key)
        }
    }

    // If neither condition is met, return undefined
    return undefined;
}

function isGetServerSidePropsContext(target: any): target is GetServerSidePropsContext {
    return (
        target &&
        typeof target === 'object' &&
        'req' in target &&
        typeof target.req === 'object' &&
        'cookies' in target.req
    );
}

export function setString(key: string, value: string, target: any | undefined = undefined): void {
    if (isGetServerSidePropsContext(target)) {
        // If target is GetServerSidePropsContext, set the cookie in context.req
        target.req.cookies[key] = value;
    } else if (typeof window !== 'undefined') {
        // If not on server side, set the value in localStorage
        localStorage.setItem(key, value);
        cookie.set(key, value)
    }
    // For any other cases (e.g., on the server without GetServerSidePropsContext), no action is taken
}