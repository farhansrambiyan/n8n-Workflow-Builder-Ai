// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
const firebaseConfig = {
  apiKey: "ENTER YOUR FIREBASE API KEY HERE",
  authDomain: "ENTER YOUR FIREBASE AUTH DOMAIN HERE",
  projectId: "ENTER YOUR FIREBASE PROJECT ID HERE",
  storageBucket: "ENTER YOUR FIREBASE STORAGE BUCKET HERE",
  messagingSenderId: "ENTER YOUR FIREBASE MESSAGING SENDER ID HERE",
  appId: "ENTER YOUR FIREBASE APP ID HERE",
  measurementId: "ENTER YOUR FIREBASE MEASUREMENT ID HERE",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
auth.languageCode = "english";
// Google authentication and sign in with popup
const btnSignup = document.getElementById("btn-google-signup");
btnSignup.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then(async (result) => {
      // Store authentication data
      const user = result.user;
      // Get Firebase ID token (not Google OAuth access token)
      const idToken = await user.getIdToken();
      const userInfo = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        accessToken: idToken, // This is now the Firebase ID token
      };
      // Store user data in sessionStorage for the close.html page
      sessionStorage.setItem("n8n_user_auth", JSON.stringify(userInfo));

      // Redirect to close.html after a short delay
      setTimeout(() => {
        window.location.href = "YOUR-DOMAIN-HERE/close.html";
      }, 1000);
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log(errorCode, errorMessage);
    });
});
