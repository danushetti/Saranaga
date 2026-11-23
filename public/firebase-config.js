// Replace these placeholders with the Firebase Web App config from Firebase Console.
// Firebase Console → Project settings → Your apps → SDK setup and configuration.
// Google sign-in is disabled until real values are supplied.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

export const isFirebaseConfigured = () =>
  Boolean(firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    !Object.values(firebaseConfig).some(value => String(value).includes("YOUR_")));
