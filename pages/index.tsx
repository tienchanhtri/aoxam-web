import React, {ChangeEventHandler, KeyboardEventHandler, useEffect, useRef, useState} from "react";
import styles from "@/styles/Index.module.css";
import SearchIcon from "@mui/icons-material/Search";
import {Async, Uninitialized} from "@/lib/async";
import {useRouter} from "next/router";
import {isBrowser} from 'react-device-detect';
import {Alert, Button, Chip, LinearProgress, Snackbar} from "@mui/material";
import {getBrowserAoxamServiceV2, PostsResponse} from "@/lib/aoxam_service";
import Link from "next/link";
import {Stack} from "@mui/system";
import {logClick, logEvent, logPageView} from "@/lib/tracker";
import {isVoySub} from "@/lib/utils";
import {Strings} from "@/lib/strings";
import Head from "next/head";
import {Response} from "ts-retrofit";
import {getString} from "@/lib/key_value_storage";
import {getBrowserAuthService, TokenParsed} from "@/lib/auth_service";
import {executePromise, executeStream} from "@/lib/hook/promise_async";
import Const from "@/lib/constants";
import Constants from "@/lib/constants";
import {PermissionTicketRepresentation} from "@/lib/aoxam-service/urp/user-resource-permission-response";
import {from} from "rxjs";


export default function Main() {
    const [query, setQuery] = useState<string>("")
    const router = useRouter()
    const [navigateAsync, setNavigateAsync] = useState<Async<boolean>>(new Uninitialized<boolean>())
    const [passwordDialogOpen, setPasswordDialogOpen] = useState<boolean>(false)
    const [checkAsync, setCheckAsync] = useState<Async<void>>(new Uninitialized())
    const passwordInputRef = useRef<HTMLInputElement>(null)
    const [showDesktopWarning, setShowDesktopWarning] = useState<boolean>(false)
    const [postsAsync, setPostAsync] = useState<Async<Response<PostsResponse>>>(new Uninitialized<Response<PostsResponse>>())

    const [jwtAsync, setJwtAsync] = useState<Async<TokenParsed | undefined>>(new Uninitialized())
    const [refreshTokenAsync, setRefreshTokenAsync] = useState<Async<string | undefined>>(new Uninitialized())
    const didRequestReadPermission = useRef(false)
    const [requestReadTicket, setRequestReadTicket] = useState<Async<PermissionTicketRepresentation>>(new Uninitialized())
    const [ownerRequest, setOwnserRequest] = useState<Async<any>>(new Uninitialized())
    useEffect(() => {
        checkLegacyApiKey()
        if (!localStorage.getItem("desktopWarningDismissed")) {
            setShowDesktopWarning(isBrowser)
        }
        logPageView("home", {
            "desktop_warning_dismissed": !!localStorage.getItem("desktopWarningDismissed")
        })
        const sub = executeStream(
            getBrowserAuthService().getAccessTokenParsedStream(),
            (async) => {
                setJwtAsync(async)
            })

        const refreshTokenSub = executePromise(
            getBrowserAuthService().refreshTokenFlow(undefined, -1),
            (async) => {
                setRefreshTokenAsync(async)
                if (async.isSucceed() && !didRequestReadPermission.current) {
                    didRequestReadPermission.current = true
                    executePromise(getBrowserAoxamServiceV2().requestViewerAccess(), (ticketAsync) => {
                        setRequestReadTicket(ticketAsync)
                    })
                    executePromise(getBrowserAoxamServiceV2().echo("owner"), (echoAsync) => {
                        setOwnserRequest(echoAsync)
                    })
                }
            }
        )


        return () => {
            sub.unsubscribe()
            refreshTokenSub.unsubscribe()
        }
    }, [])

    useEffect(() => {
        if (!checkAsync.isSucceed()) {
            return
        }
        getBrowserAoxamServiceV2().posts(
            Constants.NEXT_PUBLIC_POST_TAG,
        ).execute(null, null, (async: Async<Response<PostsResponse>>) => {
            setPostAsync(async)
        })
    }, [checkAsync])

    useEffect(() => {
        if (passwordDialogOpen) {
            logEvent("dialog_open", {
                "dialog_name": "legacy_api_key"
            })
        }
    }, [passwordDialogOpen])

    function checkLegacyApiKey() {
        if (isVoySub) {
            return
        }
        let legacyApiKey = getBrowserAuthService().getLegacyApiKey()
        if (legacyApiKey) {
            getBrowserAuthService().setLegacyApiKey(legacyApiKey)
        }
        getBrowserAuthService().isLegacyApiKeyValid()
            .execute(new AbortController(), null, (async: Async<boolean>) => {
                if (async.complete) {
                    const isValid = async.value
                    if (!isValid) {
                        setPasswordDialogOpen(true)
                    }
                    logEvent("check", {
                        "check_name": "legacy_api_key_preflight",
                        "check_result": isValid,
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
                    sematic: getString("sematic")
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

        getBrowserAoxamServiceV2().check("legacyApiKey", value)
            .then((response) => {
                if (response.status !== 204) {
                    return Promise.reject(new Error(`Status code ${response.status}`))
                }
                return Promise.resolve()
            })
            .execute(new AbortController(), null, (async: Async<void>) => {
                setCheckAsync(async)
                if (async.isSucceed()) {
                    getBrowserAuthService().setLegacyApiKey(value)
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
                            sematic: getString("sematic")
                        }
                    }
                ).onAsync((async: Async<boolean>) => setNavigateAsync(async))
            }}
        />
    })

    let posts = postsAsync.value?.data?.posts
    let showPosts = false
    if (posts != null && posts.length != 0) {
        showPosts = true
        posts = posts.slice(0, 3)
    }

    let loginButton = undefined
    let jwt = jwtAsync.value
    if (!jwt) {
        loginButton = <a
            href="#"
            onClick={() => {
                logClick("home", "sign_in")
                window.location.href = `${Const.NEXT_PUBLIC_WEB_HOST}auth`
            }}
        >Đăng nhập</a>
    }
    let userInfo = undefined
    if (jwtAsync.isSucceed() && jwt) {
        userInfo = <>
            Xin chào <a href="#" onClick={() => {
        }}>{jwt.preferred_username}</a>
            , <a href="#" onClick={() => {
            logClick("home", "sign_out")
            const token = getBrowserAuthService().getAccessTokenParsed()
            from(getBrowserAuthService().logout()).subscribe({
                next: () => {
                    logEvent("sign_out", {
                        "user_id": token?.sub,
                        "username": token?.preferred_username,
                        "success": true,
                    })
                },
                error: (err) => {
                    console.log("logout error", err)
                    logEvent("sign_out", {
                        "user_id": token?.sub,
                        "username": token?.preferred_username,
                        "success": false,
                        "error_message": err?.message
                    })
                },
                complete: () => {
                    console.log("logout complete")
                }
            })
        }}>đăng xuất</a>
        </>
    }

    const adminBlock = jwtAsync.invoke() && ownerRequest.isSucceed() ? <div style={
        {
            position: "relative",
            background: "#fff"
        }
    }>
        <a href="#" style={
            {
                position: "absolute",
                left: 16,
                top: 16,
            }
        } onClick={() => {
            window.location.href = "settings/iam"
        }}
        >Quản trị</a>
    </div> : null

    const userBlock = <div
        style={
            {
                position: "relative",
                background: "#fff"
            }
        }>
        <div style={
            {
                position: "absolute",
                top: 16,
                right: 16,
            }
        }>
            {loginButton}
            {userInfo}
        </div>
    </div>

    const legacyApiKeyValid = checkAsync.isSucceed() && checkAsync.invoke()

    const loginMessage = <>
        <p>Vui lòng đăng nhập để sử dụng tính năng tìm kiếm.</p>
        <p>Ai chưa có tài khoản thì ấn [Đăng nhập] sau đó ấn [Register] để tạo tài khoản mới.</p>
        <p>Lưu ý điền đầy đủ thông tin để được xét duyệt.</p>
    </>

    const legacyPasswordNotice = <>
        <p>Các thiết bị lưu mật khẩu cũ vẫn có thể tạm thời thực hiện tìm kiếm cho tới khi hết thời gian chuyển
            giao.</p>
    </>

    const noPermissionNotice = <>
        <p>Tài khoản {jwt?.preferred_username} chưa có quyền truy cập.</p>
        <p>Hệ thống đã gửi yêu cầu truy cập, HĐ hãy liên hệ Pháp Viên (ĐT: 0963338661) để thực hiện công tác xét
            duyệt.</p>
    </>

    const ticket = requestReadTicket.invoke()
    const ticketGranted = ticket?.granted == true
    const showNoPermission = jwt != undefined && requestReadTicket.complete && !ticketGranted
    const showLegacyNotice = legacyApiKeyValid && requestReadTicket.complete && !ticketGranted
    const showUserBlock = refreshTokenAsync.complete && jwtAsync.isSucceed()
    const loginAdviceBlock = showUserBlock ? <div className={styles.noticeBlock}>
        {jwt == undefined ? loginMessage : null}
        {showNoPermission ? noPermissionNotice : null}
        {showLegacyNotice ? legacyPasswordNotice : null}
    </div> : null

    return <>
        <Head>
            <title>{Strings.indexTitle}</title>
        </Head>
        <main className={styles.main}>
            {adminBlock}
            {showUserBlock ? userBlock : null}
            {navigateAsync.isLoading() ? <LinearProgress className={styles.navigateProgressIndicator}/> : null}
            <div className={styles.title}>
                {Strings.title}
            </div>
            <div className={styles.searchContainer}>
                <SearchIcon className={styles.searchIcon}/>
                <input type="text"
                       placeholder={Strings.indexSearchInputPlaceHolder}
                       className={styles.searchBox}
                       onChange={onQueryChanged}
                       onKeyDown={handleSearchKeyDown}
                       value={query}/>
                {
                    isVoySub ? null : <Stack direction="row"
                                             justifyContent="center"
                                             alignItems="center"
                                             spacing={1}
                                             className={styles.sampleSearchContainer}
                    >
                        {sampleChips}
                    </Stack>
                }
                {
                    showPosts ? <>
                        <div className={styles.version}>{Strings.newPost} </div>
                        {
                            posts?.map((post) => {
                                return <Link key={post.url} href={post.url}
                                             className={styles.changeLog}>{post.title}</Link>
                            })
                        }

                    </> : null
                }
                {
                    loginAdviceBlock
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
                                {Strings.ok}
                            </Button>
                        }
                    >
                        {Strings.indexOnlyOptimizedForMobile}
                    </Alert>
                </Snackbar>
            </div>
        </main>
    </>
}