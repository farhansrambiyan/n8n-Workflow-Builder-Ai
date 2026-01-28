import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

const firebaseConfig = {
 apiKey: "ENTER YOUR FIREBASE API KEY HERE",
  authDomain: "ENTER YOUR FIREBASE AUTH DOMAIN HERE",
  projectId: "ENTER YOUR FIREBASE PROJECT ID HERE",
  storageBucket: "ENTER YOUR FIREBASE STORAGE BUCKET HERE",
  messagingSenderId: "ENTER YOUR FIREBASE MESSAGING SENDER ID HERE",
  appId: "ENTER YOUR FIREBASE APP ID HERE",
  measurementId: "ENTER YOUR FIREBASE MEASUREMENT ID HERE"
};
// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export const userAuth = async (req, res) => {
    try {
        
        const { userData,accessToken} = req.body;     
        if (!userData || !accessToken) {
            return res.status(400).json({
                success: false,
                error: "Missing userData or accessToken"
            });
        }

        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(accessToken);
        
        // Validate user data matches the token
        if (decodedToken.uid !== userData.uid) {
            return res.status(401).json({
                success: false,
                error: "User ID mismatch"
            });
        }

        // Additional validation checks
        if (decodedToken.email !== userData.email) {
            return res.status(401).json({
                success: false,
                error: "Email mismatch"
            });
        }

        // Check if token is not expired
        const currentTime = Math.floor(Date.now() / 1000);
        if (decodedToken.exp < currentTime) {
            return res.status(401).json({
                success: false,
                error: "Token expired"
            });
        }

        res.status(200).json({
            success: true,
            message: "User authenticated successfully",
            userData: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                emailVerified: decodedToken.email_verified
            }
        },
)

    } catch (error) {
        console.error("User authentication error:", error);
        res.status(401).json({
            success: false,
            error: "Authentication failed",
            details: error.message
        });
    }
};