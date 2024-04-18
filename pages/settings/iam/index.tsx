import {getBrowserAoxamServiceV2} from "@/lib/aoxam_service";
import {CheckProps} from "@/pages/check";
import {executePromise, usePromiseAsync} from "@/lib/hook/promise_async";
import * as React from 'react';
import {useRef, useState} from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    TextField
} from "@mui/material";
import UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import {getUserAttrs} from "@/lib/aoxam-service/ext";
import {PermissionTicketRepresentation, UserInfo} from "@/lib/aoxam-service/urp/user-resource-permission-response";
import ResourceRepresentation from "@keycloak/keycloak-admin-client/lib/defs/resourceRepresentation";
import {Async, Uninitialized} from "@/lib/async";
import {Subscription} from "rxjs";
import LoadingButton from '@mui/lab/LoadingButton';

export default function IamPage(props: CheckProps) {
    const [urpAsync, setUrpAsync, urpSub, refreshUrp] = usePromiseAsync(() => {
        return getBrowserAoxamServiceV2().getUserResourcePermissionResponse()
    })

    const [popupUserId, setPopupUserId] = useState<string | undefined>(undefined)
    const [filterHasPendingGrant, setFilterHasPendingGrant] = useState(true)
    const resources = urpAsync.value?.resources ?? {}
    const userIdToUserInfo: { [p: string]: UserInfo } = urpAsync.value?.users ?? {}
    const usernameToUserInfo: { [p: string]: UserInfo } = {};
    Object.keys(userIdToUserInfo).forEach((userId) => {
        const user = userIdToUserInfo[userId]
        usernameToUserInfo[user.representation.username ?? ""] = user
    })
    const scopes = urpAsync.value?.scopes ?? {}

    function toggleTicket(
        requester: string,
        resource: string,
        scope: string,
    ) {
        if (toggleTicketAsync.isLoading()) {
            return
        }
        toggleTicketSub.current?.unsubscribe()
        toggleTicketSub.current = executePromise(getBrowserAoxamServiceV2().toggleTicket(
            requester,
            resource,
            scope,
        ), (async) => {
            setToggleTicketAsync(async)
            if (async.complete) {
                setOpenToggleAlert(true)
            }
            if (async.isSucceed()) {
                setInputUsername("")
                setSelectedResourceId(undefined)
                setSelectedScopeId(undefined)
                refreshUrp()
            }
        })
    }

    const rows = Object.keys(userIdToUserInfo).map((userId) => {
        const info = userIdToUserInfo[userId]
        const user: UserRepresentation = info.representation
        const buddhistName = getUserAttrs(user)?.buddhistName
        const hasPendingTicket = info.tickets
            .filter((t) => !t.granted)
            .length > 0
        if (filterHasPendingGrant && !hasPendingTicket) {
            return null
        }
        const tickets = info.tickets
            .map((ticket) => {
                const resource = resources[ticket.resource];
                const scope = scopes[ticket.scope]
                const actionText = ticket.granted ? "Remove" : "Grant"
                return <div key={ticket.id}>
                    <span>{resource.displayName} - {scope.displayName}</span>
                    <span> - </span>
                    <a href={"#"} onClick={() => {
                        toggleTicket(ticket.requester, ticket.resource, ticket.scope);
                    }}>{actionText}</a>
                </div>
            })
        return <TableRow
            key={user.id}
        >
            <TableCell component="th" scope="row">
                <a href="#" onClick={() => {
                    setPopupUserId(user.id)
                }}>{user.username}</a>
            </TableCell>
            <TableCell component="th" scope="row">
                {buddhistName}
            </TableCell>
            <TableCell component="th" scope="row">
                {tickets}
            </TableCell>
        </TableRow>
    });


    const [selectedResourceId, setSelectedResourceId] = useState<string | undefined>(undefined)
    const [selectedScopeId, setSelectedScopeId] = useState<string | undefined>(undefined)
    const [inputUsername, setInputUsername] = useState<string | undefined>(undefined)
    const [toggleTicketAsync, setToggleTicketAsync] = useState<Async<PermissionTicketRepresentation>>(new Uninitialized())
    const toggleTicketSub: React.MutableRefObject<Subscription | undefined> = useRef<Subscription | undefined>(undefined)
    const trimmedInputUsername = inputUsername?.trim()
    const [openToggleAlert, setOpenToggleAlert] = useState(false)

    const selectedResource: ResourceRepresentation | undefined = resources[selectedResourceId ?? ""]
    const selectedUser: UserInfo | undefined = usernameToUserInfo[trimmedInputUsername ?? ""]
    const selectedTickets = selectedUser?.tickets ?? []
    const availableScopes = (selectedResource?.scopes ?? []).filter((scope) => {
        const existingTicket = selectedTickets.find((ticket) => {
            return ticket.resource == selectedResource?._id && ticket.scope == scope.id
        })
        return existingTicket == undefined;
    })
    const inputUsernameValid = !trimmedInputUsername || selectedUser != undefined
    const selectedScope = scopes[selectedScopeId ?? ""]
    const addFormReady = selectedUser != undefined && selectedResource != undefined && selectedScope != undefined

    const addTicket = <div style={{marginBottom: 48}}>
        <p>Add ticket</p>
        <FormControl>
            <TextField
                error={!inputUsernameValid}
                helperText={!inputUsernameValid ? `User ${trimmedInputUsername} not found` : null}
                id="input-username"
                label="Username"
                value={inputUsername}
                onChange={(e) => {
                    setInputUsername(e.target.value)
                    setSelectedResourceId(undefined)
                    setSelectedScopeId(undefined)
                }}/>
        </FormControl>
        {selectedUser != undefined ? <FormControl style={{marginLeft: 16}}>
            <InputLabel id="select-resource">Resource</InputLabel>
            <Select
                style={{minWidth: 160}}
                autoWidth={true}
                labelId="select-resource"
                id="select-resource-select"
                value={selectedResourceId}
                label="Resource"
                onChange={(e) => {
                    setSelectedResourceId(e.target.value)
                    setSelectedScopeId(undefined)
                }}
            >
                {Object.keys(resources).map((rId) => {
                    const resource = resources[rId]
                    return <MenuItem key={resource._id} value={rId}>{resource.displayName}</MenuItem>
                })}
            </Select>
        </FormControl> : null}
        {selectedResourceId ? <FormControl style={{marginLeft: 16}}>
            <InputLabel id="select-scope-label">Scope</InputLabel>
            <Select
                style={{minWidth: 160}}
                autoWidth={true}
                labelId="select-scope-label"
                id="select-scope-label-select"
                value={selectedScopeId}
                label="Scope"
                onChange={(e) => {
                    setSelectedScopeId(e.target.value)
                }}
            >
                {availableScopes.map((scope) => {
                    const scopeR = scopes[scope.id ?? ""]
                    return <MenuItem key={scopeR.id} value={scopeR.id}>{scopeR.displayName}</MenuItem>
                })}
            </Select>
        </FormControl> : null}
        {addFormReady ? <FormControl style={{marginLeft: 16}}>
            <LoadingButton
                variant="contained"
                loading={toggleTicketAsync.isLoading()}
                onClick={() => {
                    toggleTicket(
                        selectedUser?.representation?.id ?? "",
                        selectedResource?._id ?? "",
                        selectedScope?.id ?? "",
                    )
                }}
            >
                Add
            </LoadingButton>
        </FormControl> : null}
    </div>

    let toggleMessage = ""
    if (toggleTicketAsync.isSucceed()) {
        const updatedTicket = toggleTicketAsync.invoke()
        if (updatedTicket?.granted) {
            toggleMessage = "Granted"
        } else {
            toggleMessage = "Removed"
        }
    } else if (toggleTicketAsync.isFail()) {
        toggleMessage = `Failed: ${toggleTicketAsync.error.message}`
    }
    const toggleCompleteAlert = <Snackbar
        anchorOrigin={{
            vertical: "top",
            horizontal: "center"
        }}
        autoHideDuration={3000}
        open={openToggleAlert}
        onClose={() => {
            setOpenToggleAlert(false)
        }}
        message={toggleMessage}
        key="toggleMessage"
    />
    const popupUserInfo = userIdToUserInfo[popupUserId ?? ""]
    const popupUserAttrs = getUserAttrs(popupUserInfo?.representation)

    /**
     *     fullName: string | undefined,
     *     buddhistName: string | undefined,
     *     phoneNumber: string | undefined,
     *     email: string | undefined,
     *     citizenId: string | undefined,
     */
    const popupUserDialog = popupUserInfo == undefined ? null : <>
        <Dialog open={true} onClose={() => {
            setPopupUserId(undefined)
        }}>
            <DialogTitle>User: {popupUserInfo?.representation?.username}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <p>Full name: {popupUserAttrs?.fullName}</p>
                    <p>Buddhist name: {popupUserAttrs?.buddhistName}</p>
                    <p>Phone number: {popupUserAttrs?.phoneNumber}</p>
                    <p>Email: {popupUserAttrs?.email}</p>
                    <p>Citizen ID: {popupUserAttrs?.citizenId}</p>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {
                    setPopupUserId(undefined)
                }}>Đóng</Button>
            </DialogActions>
        </Dialog>
    </>


    return <div style={{padding: 16}}>
        {/*{JSON.stringify(urpAsync.debugName, null, 2)}*/}
        {addTicket}
        {toggleCompleteAlert}
        <div>
            Users
        </div>
        <FormControlLabel control={
            <Checkbox
                checked={filterHasPendingGrant}
                onChange={(e) => {
                    setFilterHasPendingGrant(e.target.checked)
                }}
                inputProps={{'aria-label': 'controlled'}}
            />
        } label="Filter user who has pending ticket grant"/>

        <TableContainer component={Paper}>
            <Table aria-label="simple table">
                <TableHead>
                    <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell>Buddhist Name</TableCell>
                        <TableCell>Tickets</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows}
                </TableBody>
            </Table>
        </TableContainer>
        {popupUserDialog}
    </div>
}