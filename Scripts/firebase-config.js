// Firebase configuration for oh-tools Web App
const firebaseConfig = {
  apiKey: "AIzaSyDc-zund2ZgmG1hWMs2_TqOR9zctcW6sKk",
  authDomain: "oh-tools.firebaseapp.com",
  projectId: "oh-tools",
  storageBucket: "oh-tools.firebasestorage.app",
  messagingSenderId: "587460903895",
  appId: "1:587460903895:web:c9c321a941587ee42b0192",
  measurementId: "G-BR0BGLZ11Z"
};

// Initialize Firebase compat
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  console.log("Firebase initialized successfully.");
} else {
  console.warn("Firebase SDK not loaded yet.");
}
