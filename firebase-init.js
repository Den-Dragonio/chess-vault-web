// firebase-init.js — тільки ініціалізація Firebase (без UI, без анімацій)
// Використовується на сторінках де не потрібна повна логіка script.js

const firebaseConfig = {
    apiKey: "AIzaSyDUG7SSTj-iU_3rYEueN47uzfotv-q9YKI",
    authDomain: "chess-lib.firebaseapp.com",
    projectId: "chess-lib",
    storageBucket: "chess-lib.firebasestorage.app",
    messagingSenderId: "379371526786",
    appId: "1:379371526786:web:0af0d17c42c7ba16e2f29b",
    measurementId: "G-67D80FFP24"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
