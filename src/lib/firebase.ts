// Import the functions you need from the SDKs you need

import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyB2IfJQsaQ0T9JLy7j0MmfcgV9dEa6-lac",
	authDomain: "eye-academy-88034.firebaseapp.com",
	projectId: "eye-academy-88034",
	storageBucket: "eye-academy-88034.firebasestorage.app",
	messagingSenderId: "397061531443",
	appId: "1:397061531443:web:db0c3a178780dbd33fc046",
	measurementId: "G-0TSN1054L8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

if (typeof window !== "undefined") {
	getAnalytics(app);
}

//Init Services
export const auth = getAuth(app);
