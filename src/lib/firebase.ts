import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
	apiKey: "AIzaSyB2IfJQsaQ0T9JLy7j0MmfcgV9dEa6-lac",
	authDomain: "eye-academy-88034.firebaseapp.com",
	projectId: "eye-academy-88034",
	storageBucket: "eye-academy-88034.firebasestorage.app",
	messagingSenderId: "397061531443",
	appId: "1:397061531443:web:db0c3a178780dbd33fc046",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
