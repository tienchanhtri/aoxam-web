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
import {isLegacyApiKeyValid, parseLegacyApiKeyFromCookie, setLegacyApiKey} from "@/lib/auth";
import Link from "next/link";
import {Stack} from "@mui/system";
import {logClick, logEvent, logPageView} from "@/lib/tracker";


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
        logPageView("home", {
            "desktop_warning_dismissed": !!localStorage.getItem("desktopWarningDismissed")
        })
    }, [])

    useEffect(() => {
        if (passwordDialogOpen) {
            logEvent("dialog_open", {
                "dialog_name": "legacy_api_key"
            })
        }
    }, [passwordDialogOpen])

    function checkLegacyApiKey() {
        let legacyApiKeySource: string | null = null
        let legacyApiKey: string | null = null

        let legacyApiKeyFromCookie = parseLegacyApiKeyFromCookie()
        if (legacyApiKeyFromCookie) {
            legacyApiKeySource = "cookie"
            legacyApiKey = legacyApiKeyFromCookie
        } else if (localStorage.getItem("legacyApiKey")) {
            legacyApiKeySource = "legacy_api_key"
            legacyApiKey = localStorage.getItem("legacyApiKey")
        } else if (localStorage.getItem("apiKey")) {
            let meilisearchKey = localStorage.getItem("apiKey")
            if (meilisearchKey && meilisearchKey[0] === '"' && meilisearchKey[meilisearchKey.length - 1] === '"') {
                meilisearchKey = meilisearchKey.substring(1, meilisearchKey.length - 1)
            }
            if (meilisearchKey) {
                legacyApiKeySource = "meilisearch"
                legacyApiKey = meilisearchKey
            }
        }
        if (legacyApiKey) {
            setLegacyApiKey(legacyApiKey)
        }
        isLegacyApiKeyValid(legacyApiKey)
            .execute(new AbortController(), null, (async: Async<boolean>) => {
                if (async.complete) {
                    const isValid = async.value
                    if (!isValid) {
                        setPasswordDialogOpen(true)
                    }
                    logEvent("check", {
                        "check_name": "legacy_api_key_preflight",
                        "check_result": isValid,
                        "source": legacyApiKeySource,
                    })
                }
                // @ts-ignore
                setCheckAsync(async)
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
            .execute(new AbortController(), null, (async: Async<void>) => {
                setCheckAsync(async)
                if (async.isSucceed()) {
                    setLegacyApiKey(value)
                    setPasswordDialogOpen(false);
                    (passwordInputRef.current as HTMLElement).blur()
                }
                if (async.isSucceed() || async.isFail()) {
                    logEvent("check", {
                        "check_name": "legacy_api_key",
                        "check_result": !!async.isSucceed()
                    })
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
    const sampleChips = ["big bang", "tứ diệu đế", "bát chánh đạo"].map((sampleQ) => {
        return <Chip
            key={sampleQ}
            className={styles.sampleSearchChip}
            label={sampleQ}
            variant="outlined"
            size="small"
            clickable={true}
            onClick={() => {
                // noinspection JSIgnoredPromiseFromCall
                logClick("home", "suggested_keyword", {
                    "keyword": sampleQ
                })
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

    const showReleaseNote = checkAsync.isSucceed()

    const demoHref = {
        pathname: `/search`,
        query: {
            q: "big bang",
        }
    }
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
            {
                showReleaseNote ? <>
                    <div className={styles.version}>Phiên bản 2023-04-19</div>
                    <div className={styles.changeLog}>
                        <p>
                            Thêm nội dung của Facebook Trần Chánh Nhân vào bộ máy tìm kiếm.
                            Thử tìm với từ khóa "big bang" hoặc nhấn vào <Link href={demoHref}>đây</Link>.
                        </p>
                    </div>
                    <Link href={demoHref}>
                        <img className={styles.demoImage} src={"release_2023_04_19_demo.webp"} />
                    </Link>

                    <div className={styles.version}>Phiên bản 2023-03-26</div>
                    <div className={styles.changeLog}>
                        Sửa lỗi phải nhập lại password dù trước đó đã nhập rồi
                    </div>
                </> : null
            }

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