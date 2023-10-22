import Head from 'next/head'
import '../../lib/async'
import styles from "../../styles/DownloadYoutubeSubtitle.module.css";
import {getRedirectProps, parseLegacyApiKeyFromLocalStorage, redirectToHome} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";
import {Button, TextField} from "@mui/material";
import {extractVideoId, isVoySub} from "@/lib/utils";
import React, {useEffect, useState} from "react";
import {logPageView} from "@/lib/tracker";
import YouTube from "react-youtube";
import process from "process";

interface DownloadYoutubeSubtitleProps {
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (isVoySub) {
        return redirectToHome
    }

    const redirectProps = await getRedirectProps(context)
    if (redirectProps) {
        return redirectProps
    }

    const props: { props: DownloadYoutubeSubtitleProps } = {
        props: {},
    }
    return props
}

export default function DownloadYoutubeSubtitle(props: DownloadYoutubeSubtitleProps) {
    const [submittedQuery, setSubmittedQuery] = useState<String>("")
    const [query, setQuery] = useState<String>("")

    const trimmedQuery = query.trim()
    const trimmedSubmittedQuery = submittedQuery.trim()

    const queryAndSubmittedQueryIsSame = trimmedQuery.length > 0 && trimmedQuery === trimmedSubmittedQuery
    const videoId = extractVideoId(trimmedSubmittedQuery)
    const showVideo = queryAndSubmittedQueryIsSame && videoId
    function onViewButtonClick() {
        if (!query) {
            return
        }
        setSubmittedQuery(query)
    }

    useEffect(() => {
        logPageView("download_youtube_subtitle", {})
    }, []);

    function renderLink(isAuto: boolean, subLangs: string) {
        if (!videoId) {
            return null
        }
        return <a
            target="_blank"
            href={`${process.env.NEXT_PUBLIC_API_HOST!!}downloadYoutubeSubtitle?videoId=${encodeURIComponent(videoId)}&isAuto=${isAuto}&subLangs=${encodeURIComponent(subLangs)}&legacyApiKey=${encodeURIComponent(parseLegacyApiKeyFromLocalStorage() ?? "")}`}>
            [Download]
        </a>
    }

    const downloadSection = <>
        <p>Với video tiếng việt</p>
        <br/>
        <p><u>Phụ đề làm bằng tay</u></p>
        <p>Tiếng Việt (1): {renderLink(false, "vi")}</p>
        <p>Tiếng Anh (2): {renderLink(false, "en")}</p>
        <br/>
        <p><u>Phụ đề youtube tự động tạo</u></p>
        <p>Tiếng Việt (3): phiên âm tiếng việt từ youtube {renderLink(true, "vi-orig")}</p>
        <p>Tiếng Anh: google translate (3) qua tiếng anh {renderLink(true, "en")}</p>
        <br/>
        <p>Tiếng Việt vi-en: google translate (2) qua tiếng việt {renderLink(true, "vi-en")}</p>
        <p>Tiếng Anh en-vi: google translate (1) qua tiếng anh {renderLink(true, "en-vi")}</p>
        <br/>
        <p>Trang chuyển phụ đề qua srt, txt</p>
        <a target="_blank"
           href={"https://www.happyscribe.com/subtitle-tools/subtitle-converter"}>https://www.happyscribe.com/subtitle-tools/subtitle-converter</a>
        <p>Hiện tại mình chỉ có thể download phụ đề có trên youtube, click vào link không có phụ đề thì sẽ không
            download được ạ</p>
    </>

    return (
        <>
            <Head>
                <title>Tải phụ đề youtube</title>
            </Head>
            <main className={styles.main}>
                <div>
                    <TextField
                        key={"input-query"}
                        label="Link youtube hoặc video id"
                        variant="outlined"
                        placeholder={"https://www.youtube.com/watch?v=bd5bMvWeOU4"}
                        value={query}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            setQuery(event.target.value);
                        }}
                    />
                </div>
                <div className={styles.searchButton}>
                    <Button
                        key={"view-button"}
                        variant="contained"
                        onClick={() => onViewButtonClick()}
                    >
                        Xem
                    </Button>
                </div>
                {showVideo ?
                    <div className={styles.videoContainer}>
                        <YouTube
                            className={styles.youtubePlayer}
                            videoId={videoId}
                            opts={
                                {
                                    height: '100%',
                                    width: '100%',
                                    playerVars: {
                                        autoplay: 0,
                                        modestbranding: 1,
                                        rel: 0
                                    },
                                }
                            }
                        />
                    </div> : null
                }
                {
                    showVideo ? downloadSection : null
                }
            </main>

        </>
    )
}

