import Head from 'next/head'
import '../../lib/async'
import styles from "../../styles/Transcribe.module.css";
import {getRedirectProps, parseLegacyApiKeyFromLocalStorage, redirectToHome} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";
import {Strings} from "@/lib/strings";
import {Button, Card, CardActions, CardContent, TextField, Typography} from "@mui/material";
import {extractVideoId, isVoySub} from "@/lib/utils";
import React, {useEffect, useState} from "react";
import {aoxamService, ExternalTranscribeRequestStatus, GetExternalTranscribeRequestResponse} from "@/lib/aoxam_service";
import {Async, Uninitialized} from "@/lib/async";
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';
import Link from "next/link";
import {logClick, logPageView} from "@/lib/tracker";

interface TranscribeProps {
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (isVoySub) {
        return redirectToHome
    }

    const redirectProps = await getRedirectProps(context)
    if (redirectProps) {
        return redirectProps
    }

    const props: { props: TranscribeProps } = {
        props: {},
    }
    return props
}

export interface ExternalTranscribeRequestHistory {
    list: ExternalTranscribeRequestStatus[]
}

function getRequestHistory(): ExternalTranscribeRequestHistory {
    const json = localStorage.getItem("ExternalTranscribeRequestHistory")
    if (!json) {
        return {
            list: []
        }
    }
    try {
        const obj = JSON.parse(json)
        console.log("parse result:")
        console.log(obj)
        return obj
    } catch (e) {
        console.error(e)
    }
    return {
        list: []
    }
}

// TODO move tracking event to somewhere else
function upsertHistory(newStatus: ExternalTranscribeRequestStatus[], query: string | undefined) {
    const history: ExternalTranscribeRequestStatus[] = getRequestHistory().list
    let newHistory: ExternalTranscribeRequestStatus[] = []
    const set = new Set<string>()
    for (let status of newStatus) {
        if (!set.has(status.videoId)) {
            newHistory.push(status)
            set.add(status.videoId)
        }
    }

    for (let status of history) {
        if (!set.has(status.videoId)) {
            newHistory.push(status)
            set.add(status.videoId)
        }
    }

    // try to parse the video in query in case we submit already transcribed video
    if (query) {
        let videoId: string | undefined = undefined
        try {
            videoId = extractVideoId(query)
        } catch (e) {
            console.log(e)
        }
        if (videoId) {

            let entry: ExternalTranscribeRequestStatus | undefined = undefined
            entry = newHistory.find((r) => r.videoId === videoId)
            if (entry == undefined) {
                entry = {
                    videoId: videoId,
                    videoTitle: undefined,
                    manualSubtitleLink: undefined,
                    whisperSubtitleLink: undefined,
                }
            }
            logClick("transcribe", "submit", {
                "video_id": entry.videoId,
            })

            newHistory = [entry, ...newHistory.filter((r) => r.videoId !== videoId)]
        }
    }

    newHistory = newHistory.splice(0, Math.min(20, newHistory.length))
    const newRecord: ExternalTranscribeRequestHistory = {
        list: newHistory
    }
    localStorage.setItem("ExternalTranscribeRequestHistory", JSON.stringify(newRecord))
}

export default function Transcribe(props: TranscribeProps) {
    const [transcribeRequest, setTranscribeRequest] = useState<Async<GetExternalTranscribeRequestResponse>>(new Uninitialized())
    const [submitRequest, setSubmitRequest] = useState<Async<GetExternalTranscribeRequestResponse>>(new Uninitialized())
    const [input, setInput] = useState('');

    function reload() {
        const history = getRequestHistory().list.map((r) => r.videoId)
        aoxamService.getExternalVideoTranscribe(
            parseLegacyApiKeyFromLocalStorage(),
            history.join(",")
        )
            .then((r) => r.data)
            .execute(null, transcribeRequest.value, (async: Async<GetExternalTranscribeRequestResponse>) => {
                setTranscribeRequest(async)
            })
    }

    function submitTranscribeRequest(query: string, rerun: boolean | undefined) {
        aoxamService.postExternalVideoTranscribe(parseLegacyApiKeyFromLocalStorage(), query, rerun)
            .then((r) => r.data)
            .execute(null, null, (async: Async<GetExternalTranscribeRequestResponse>) => {
                setSubmitRequest(async)
                if (async.isSucceed()) {
                    upsertHistory(async.value?.list ?? [], query)
                    reload()
                }
            })
    }

    function onDownloadClick(videoId: string, subType: string) {
        logClick("transcribe", "download", {
            type: subType,
            video_id: videoId
        })
    }

    function onSubmitButtonClick() {
        const query = input.trim()
        if (!query) {
            return
        }
        submitTranscribeRequest(query, undefined)
        setInput('')
    }

    useEffect(() => {
        reload()
        logPageView("transcribe", {})
    }, []);

    const requestList = transcribeRequest.value?.list ?? []

    return (
        <>
            <Head>
                <title>{Strings.transcribeTitle}</title>
            </Head>
            <main className={styles.main}>
                <div>
                    <TextField
                        key={"input-query"}
                        label="Link youtube hoặc video id"
                        variant="outlined"
                        placeholder={"https://www.youtube.com/watch?v=cvqtTbFldiI"}
                        value={input}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            setInput(event.target.value);
                        }}
                    />
                </div>
                <div className={styles.searchButton}>
                    <Button
                        key={"submit-button"}
                        variant="contained"
                        onClick={() => onSubmitButtonClick()}
                    >
                        Gửi yêu cầu
                    </Button>
                </div>
                {
                    requestList.map((request, index) => {
                        const isProcessing = !request.whisperSubtitleLink && !request.manualSubtitleLink
                        const showRerunButton = false // implement later
                        return <Card key={request.videoId} className={styles.requestEntry}>
                            <CardContent key={"card-content"}>
                                <Typography key={"card-video-id"} sx={{fontSize: 14}} color="text.secondary"
                                            gutterBottom>
                                    {request.videoId}
                                </Typography>
                                {request.videoTitle ?
                                    <Typography key={"card-video-title"} variant="h5" component="div">
                                        {isProcessing ?
                                            <>{request.videoTitle ?? request.videoId}</>
                                            :
                                            <a target="_blank"
                                               href={`yt_${request.videoId}`}>{request.videoTitle ?? request.videoId}</a>
                                        }

                                    </Typography> : null
                                }
                                {isProcessing ?
                                    <Typography variant="body2">
                                        đang xử lý...
                                    </Typography> : null
                                }
                            </CardContent>
                            {showRerunButton ? <>
                                <CardActions>
                                    <Button
                                        endIcon={<ReplayIcon/>}
                                        variant="outlined"
                                        key={`download ${request.manualSubtitleLink}`}
                                    >
                                        Tạo lại phụ đề Whisper
                                    </Button>
                                </CardActions>
                            </> : null
                            }
                            <CardActions>
                                {request.manualSubtitleLink ?
                                    <Button
                                        onClick={() => onDownloadClick(request.videoId, "manual")}
                                        href={request.manualSubtitleLink}
                                        endIcon={<DownloadIcon/>}
                                        key={`download ${request.manualSubtitleLink}`} variant="contained"
                                    >
                                        Phụ đề thủ công
                                    </Button> : null
                                }
                                {request.whisperSubtitleLink ?
                                    <Button
                                        onClick={() => onDownloadClick(request.videoId, "whisper")}
                                        href={request.whisperSubtitleLink}
                                        endIcon={<DownloadIcon/>}
                                        key={`download ${request.whisperSubtitleLink}`} variant="contained"
                                    >
                                        Phụ đề Whisper
                                    </Button> : null
                                }
                            </CardActions>
                            {showRerunButton ?
                                <>
                                </> : null
                            }
                        </Card>
                    })
                }
                <div className={styles.tut}>
                    <Link
                        href="https://docs.google.com/document/d/1W-SYV1-77v0AabXzhP24ebeCO36RJrwb_s5YFv3CO4E/edit?usp=sharing">
                        Đọc hướng dẫn sử dụng trước khi dùng
                    </Link>
                </div>
            </main>

        </>
    )
}

