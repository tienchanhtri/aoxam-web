import Head from 'next/head'
import '../../lib/async'
import styles from "../../styles/DownloadYoutubeSubtitle.module.css";
import {getRedirectProps, redirectToHome} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";
import {Button, FormControl, InputLabel, MenuItem, Select, TextField} from "@mui/material";
import {extractVideoId, isVoySub} from "@/lib/utils";
import React, {useEffect, useState} from "react";
import {logPageView} from "@/lib/tracker";
import YouTube from "react-youtube";
import DownloadIcon from "@mui/icons-material/Download";
import Constants from "@/lib/constants";

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

interface TranslateOption {
    displayName: string,
    isTranslate: boolean,
    isAuto: boolean,
    subLangs: string,
}

interface DownloadOption {
    displayName: string,
    translateOptions: TranslateOption[],
}

const downloadOptions: DownloadOption[] = [
    {
        displayName: "Tiếng Việt",
        translateOptions: [
            {
                displayName: "(không dùng)",
                isTranslate: false,
                isAuto: false,
                subLangs: "vi"
            },
            {
                displayName: "Tiếng Anh",
                isTranslate: true,
                isAuto: true,
                subLangs: "en-vi"
            }
        ],
    },
    {
        displayName: "Tiếng Anh",
        translateOptions: [
            {
                displayName: "(không dùng)",
                isTranslate: false,
                isAuto: false,
                subLangs: "en"
            },
            {
                displayName: "Tiếng Việt",
                isTranslate: true,
                isAuto: true,
                subLangs: "en-vi"
            }
        ],
    },
    {
        displayName: "Tiếng Việt (được tạo tự động)",
        translateOptions: [
            {
                displayName: "(không dùng)",
                isTranslate: false,
                isAuto: true,
                subLangs: "vi-orig"
            },
            {
                displayName: "Tiếng Anh",
                isTranslate: true,
                isAuto: true,
                subLangs: "en"
            }
        ],
    },
]

export default function DownloadYoutubeSubtitle(props: DownloadYoutubeSubtitleProps) {
    const [submittedQuery, setSubmittedQuery] = useState<String>("")
    const [query, setQuery] = useState<String>("")
    const [selectedDownloadOptionId, setSelectedDownloadOptionId] = useState(0)
    const [selectedTranscribeOptionId, setSelectedTranscribeOptionId] = useState(0)

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
        return
    }

    const selectedDownloadOption = downloadOptions[selectedDownloadOptionId]
    const selectedTranslateOption = selectedDownloadOption.translateOptions[selectedTranscribeOptionId]

    const downloadSection = <>
        <FormControl
            fullWidth
            style={{
                marginTop: "32px",
            }}
        >
            <InputLabel id="download-option-language-label">Ngôn ngữ</InputLabel>
            <Select
                style={{
                    width: '250px'
                }}
                id="download-option-language-select"
                value={selectedDownloadOptionId}
                label="Ngôn ngữ"
                onChange={(event) => {
                    setSelectedDownloadOptionId(+event.target.value)
                    setSelectedTranscribeOptionId(0)
                }}
            >
                {
                    downloadOptions.map((option, index) => {
                        return <MenuItem
                            key={option.displayName}
                            value={index}
                        >{option.displayName}</MenuItem>
                    })
                }
            </Select>
        </FormControl>

        <FormControl
            fullWidth
            style={{
                marginTop: "32px",
            }}
        >
            <InputLabel id="translate-option-language-label">Google translate qua</InputLabel>
            <Select
                style={{
                    width: '250px'
                }}
                id="translate-option-language-select"
                value={selectedTranscribeOptionId}
                label="Google translate qua"
                onChange={(event) => {
                    setSelectedTranscribeOptionId(+event.target.value)
                }}
            >
                {
                    selectedDownloadOption.translateOptions.map((option, index) => {
                        return <MenuItem
                            key={option.displayName}
                            value={index}
                        >{option.displayName}</MenuItem>
                    })
                }
            </Select>
        </FormControl>
        {
            videoId ? <Button
                style={{
                    marginTop: "32px"
                }}
                variant="contained"
                startIcon={<DownloadIcon/>}
                target="_blank"
                href={`${Constants.NEXT_PUBLIC_API_HOST}downloadYoutubeSubtitle?videoId=${encodeURIComponent(videoId ?? "")}&isAuto=${selectedTranslateOption.isAuto}&subLangs=${encodeURIComponent(selectedTranslateOption.subLangs)}}`}
            >
                Download
            </Button> : null
        }
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
                    showVideo || true ? downloadSection : null
                }
            </main>

        </>
    )
}

