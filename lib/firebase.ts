import {FirebaseApp, initializeApp} from "firebase/app";
import {Analytics, getAnalytics} from "firebase/analytics";
import Constants from "@/lib/constants";

const firebaseConfig = {
    apiKey: Constants.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: Constants.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: Constants.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: Constants.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: Constants.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: Constants.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: Constants.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp

function getFirebaseApp(): FirebaseApp {
    if (app == undefined) {
        app = initializeApp(firebaseConfig);
    }
    return app
}

export function getFirebaseAnalytic(): Analytics {
    return getAnalytics(getFirebaseApp())
}