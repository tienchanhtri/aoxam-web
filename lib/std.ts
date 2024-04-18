export function runCatchingOrNull<T>(block: () => T): T | undefined {
    try {
        return block()
    } catch (error) {
        return undefined
    }
}

export async function runCatchingOrNullAsync<T>(block: () => Promise<T>): Promise<T | undefined> {
    try {
        return await block()
    } catch (error) {
        return undefined
    }
}
