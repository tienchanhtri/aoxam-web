import {FirebaseApp, initializeApp} from "firebase/app";
import {Analytics, getAnalytics} from "firebase/analytics";
import * as process from "process";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
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