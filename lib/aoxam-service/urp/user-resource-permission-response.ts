import ResourceRepresentation from "@keycloak/keycloak-admin-client/lib/defs/resourceRepresentation";
import UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import ScopeRepresentation from "@keycloak/keycloak-admin-client/lib/defs/scopeRepresentation";

export interface UserResourcePermissionResponse {
    users: { [key: string]: UserInfo }
    resources: { [key: string]: ResourceRepresentation }
    scopes: { [key: string]: ScopeRepresentation }
}

export interface UserInfo {
    representation: UserRepresentation,
    tickets: [PermissionTicketRepresentation],
}

export interface PermissionTicketRepresentation {
    id: string,
    owner: string,
    resource: string,
    scope: string,
    granted: boolean,
    requester: string,
}