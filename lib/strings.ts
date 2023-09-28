import {isVoySub} from "@/lib/utils";

export interface Strings {
    title: string,
    ok: string,

    indexSearchInputPlaceHolder: string,
    indexOnlyOptimizedForMobile: string,
    indexTitle: string,

    searchTitlePrefix: string,
    searchNextPage: string,
    searchNoResult: string,
    searchEndOfResult: string,

    docSearchPlaceHolder: string,

    newPost: string,
    transcribeTitle: string,
}

const EN: Strings = {
    title: "Voysub",
    ok: "OK",

    indexSearchInputPlaceHolder: "Enter keyword then press \"enter\" to search",
    indexOnlyOptimizedForMobile: "This UI only optimized for mobile",
    indexTitle: "Voysub",

    searchTitlePrefix: "Voysub - ",
    searchNextPage: "Next page",
    searchNoResult: "No result",
    searchEndOfResult: "End of search result",

    docSearchPlaceHolder: "Search in page...",
    newPost: "New post",
    transcribeTitle: "Voysub transcribe"
}

const VI: Strings = {
    title: "ÁoXám.vn",
    ok: "OK",

    indexSearchInputPlaceHolder: "Nhập từ khóa rồi nhấn enter để tìm kiếm",
    indexOnlyOptimizedForMobile: "Giao diện chỉ được tối ưu cho điện thoại",
    indexTitle: "Áo xám",

    searchTitlePrefix: "Áo Xám - ",
    searchNextPage: "Trang kế tiếp",
    searchNoResult: "Không có kết quả nào",
    searchEndOfResult: "Cuối kết quả tìm kiếm",

    docSearchPlaceHolder: "Tìm trong bài...",
    newPost: "Bài viết mới nhất",
    transcribeTitle: "Tạo và tải phụ đề"
}


export const Strings: Strings = isVoySub ? EN : VI