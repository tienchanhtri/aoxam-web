import UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";

interface AxUserAttrs {
    username: string,
    fullName: string | undefined,
    buddhistName: string | undefined,
    phoneNumber: string | undefined,
    email: string | undefined,
    citizenId: string | undefined,
}

function getAttr(user: UserRepresentation, name: string): string | undefined {
    const [value] = user.attributes?.[name] ?? [];
    return value
}

export function getUserAttrs(user: UserRepresentation | undefined): AxUserAttrs | undefined {
    if (!user) {
        return undefined
    }
    return {
        username: user.username ?? "",
        fullName: getAttr(user, "fullName"),
        buddhistName: getAttr(user, "buddhistName"),
        phoneNumber: getAttr(user, "phoneNumber"),
        email: user.email,
        citizenId: getAttr(user, "citizenId"),

    }
}