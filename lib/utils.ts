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