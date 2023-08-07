import * as process from "process";

export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function nextLoop(): Promise<void> {
    return sleep(0)
}

export function pad(num: number, size: number) {
    let numStr = num.toString()
    while (numStr.length < size) {
        numStr = "0" + numStr
    }
    return numStr
}

export function isLocalMachine(): Boolean {
    return process.env.NEXT_PUBLIC_LOCAL_MACHINE === "true";
}

export function convertStringToMap(input: string | undefined): Map<string, string> {
    if (input == undefined) {
        return new Map<string, string>();
    }
    const pairs = input.split(',');
    const map = new Map<string, string>();

    for (let i = 0; i < pairs.length; i += 2) {
        const key = pairs[i].trim();
        const value = pairs[i + 1].trim();
        map.set(key, value);
    }

    return map;
}

export function groupBySet<T, K, V>(
    entries: Array<T>,
    keySelector: (e: T) => K,
    valueTransform: (e: T) => V
): Map<K, Set<V>> {
    const map = new Map<K, Set<V>>()
    entries.forEach((e) => {
        const key = keySelector(e)
        let values = map.get(key)
        if (!values) {
            values = new Set()
        }
        const value = valueTransform(e)
        values.add(value)
        map.set(key, values)
    })
    return map
}

export const isVoySub = process.env.NEXT_PUBLIC_IS_VOYSUB === 'true'