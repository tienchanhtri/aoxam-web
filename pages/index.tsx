import React, {ChangeEventHandler, KeyboardEventHandler, useEffect, useRef, useState} from "react";
import styles from "@/styles/Index.module.css";
import SearchIcon from "@mui/icons-material/Search";
import {Async, Uninitialized} from "@/lib/async";
import {useRouter} from "next/router";
import {isBrowser} from 'react-device-detect';
import {
    Alert,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    LinearProgress,
    Snackbar,
    TextField
} from "@mui/material";
import {aoxamService} from "@/lib/aoxam_service";
import {isLegacyApiKeyValid, parseLegacyApiKeyFromCookie} from "@/lib/auth";
import Link from "next/link";
import {Stack} from "@mui/system";
import * as process from "process";


const cookie = require('cookie-cutter');


export default function Main() {
    const [query, setQuery] = useState<string>("")
    const router = useRouter()
    const [navigateAsync, setNavigateAsync] = useState<Async<boolean>>(new Uninitialized<boolean>())
    const [passwordDialogOpen, setPasswordDialogOpen] = useState<boolean>(false)
    const [checkAsync, setCheckAsync] = useState<Async<void>>(new Uninitialized())
    const passwordInputRef = useRef<HTMLInputElement>(null)
    const [showDesktopWarning, setShowDesktopWarning] = useState<boolean>(false)

    useEffect(() => {
        checkLegacyApiKey()
        if (!localStorage.getItem("desktopWarningDismissed")) {
            setShowDesktopWarning(isBrowser)
        }
    }, [])

    function checkLegacyApiKey() {
        if (!parseLegacyApiKeyFromCookie()) {
            let legacyApiKey = localStorage.getItem("apiKey")
            if (legacyApiKey) {
                if (legacyApiKey[0] === '"' && legacyApiKey[legacyApiKey.length - 1] === '"') {
                    legacyApiKey = legacyApiKey.substring(1, legacyApiKey.length - 1)
                }
                cookie.set("legacyApiKey", legacyApiKey)
            }
        }
        const legacyApiKey = parseLegacyApiKeyFromCookie()
        isLegacyApiKeyValid(legacyApiKey)
            .then((isValid) => {
                if (!isValid) {
                    setPasswordDialogOpen(true)
                }
            })
    }

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setQuery(event.target.value)
    }

    const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            (event.target as HTMLElement).blur()
            router.push({
                pathname: `/search`,
                query: {
                    q: query,
                }
            }).onAsync((async: Async<boolean>) => {
                setNavigateAsync(async)
            }).then(() => {
                // do nothing
            })
        }
    };
    const handleConfirm = () => {
        const value = passwordInputRef.current?.value
        if (!value) {
            return
        }

        aoxamService.check("legacyApiKey", value)
            .then((response) => {
                if (response.status !== 204) {
                    return Promise.reject(new Error(`Status code ${response.status}`))
                }
                return Promise.resolve()
            })
            .delayInLocal(1500)
            .execute(new AbortController(), null, (async: Async<void>) => {
                setCheckAsync(async)
                if (async.isSucceed()) {
                    cookie.set("legacyApiKey", value)
                    setPasswordDialogOpen(false);
                    (passwordInputRef.current as HTMLElement).blur()
                }
            })

    };

    const handleConfirmKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            handleConfirm()
        }
    }

    const handleDismissWarning = function () {
        setShowDesktopWarning(false)
        localStorage.setItem("desktopWarningDismissed", "true")
    }
    const sampleChips = ["tứ diệu đế", "bát chánh đạo", "tứ niệm xứ"].map((sampleQ) => {
        return <Chip
            className={styles.sampleSearchChip}
            label={sampleQ}
            variant="outlined"
            size="small"
            clickable={true}
            onClick={() => {
                // noinspection JSIgnoredPromiseFromCall
                router.push(
                    {
                        pathname: `/search`,
                        query: {
                            q: sampleQ,
                        }
                    }
                ).onAsync((async: Async<boolean>) => setNavigateAsync(async))
            }}
        />
    })

    return <>
        {navigateAsync.isLoading() ? <LinearProgress className={styles.navigateProgressIndicator}/> : null}
        <div className={styles.title}>Aoxam.vn</div>
        <div className={styles.searchContainer}>
            <SearchIcon className={styles.searchIcon}/>
            <input type="text"
                   placeholder={"Nhập từ khóa rồi nhấn enter để tìm kiếm"}
                   className={styles.searchBox}
                   onChange={onQueryChanged}
                   onKeyDown={handleSearchKeyDown}
                   value={query}/>
            <Stack direction="row"
                   justifyContent="center"
                   alignItems="center"
                   spacing={1}
                   className={styles.sampleSearchContainer}
            >
                {sampleChips}
            </Stack>
            <Link href={process.env.NEXT_PUBLIC_OLD_UI_HREF ?? ""} className={styles.oldLink}>Giao diện cũ</Link>
            <Snackbar
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right"
                }}
                open={showDesktopWarning}
                onClose={() => setShowDesktopWarning(false)}
                autoHideDuration={6000}
            >
                <Alert
                    severity="warning"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={handleDismissWarning}
                        >
                            Đã hiểu
                        </Button>
                    }
                >
                    Giao diện chỉ được tối ưu cho điện thoại
                </Alert>
            </Snackbar>
        </div>
        <Dialog open={passwordDialogOpen} onClose={handleConfirm}>
            <DialogTitle>Vui lòng nhập mật khẩu</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Nhập mật khẩu (API Key) của trang cũ. Nếu bạn quên mật khẩu, hãy liên hệ với người giới thiệu cho
                    bạn trang web này.
                </DialogContentText>
                <TextField
                    error={checkAsync.isFail()}
                    helperText={checkAsync.isFail() ? "Sai mật khẩu (API Key)" : null}
                    inputRef={passwordInputRef}
                    inputProps={{
                        onKeyDown: handleConfirmKeyDown,
                    }}
                    autoFocus
                    margin="dense"
                    id="name"
                    type="password"
                    fullWidth
                    variant="standard"
                />
            </DialogContent>
            <DialogActions>
                {checkAsync.isLoading() ? <CircularProgress size={24}/> : null}
                <Button onClick={handleConfirm}>Xác nhận</Button>
            </DialogActions>
        </Dialog>

    </>
}