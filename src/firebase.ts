import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Sua configuração (mantida conforme enviou)
const firebaseConfig = {
  apiKey: "AIzaSyDuGyOAB7_jBbsbMrmunxsuTIharKLoFR0",
  authDomain: "projeto-tg-edef9.firebaseapp.com",
  projectId: "projeto-tg-edef9",
  storageBucket: "projeto-tg-edef9.firebasestorage.app",
  messagingSenderId: "882195229531",
  appId: "1:882195229531:web:47c3bb3241b4569f92887e",
  measurementId: "G-BTQ8LTE25R"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Analytics (opcional)
export const analytics = getAnalytics(app);

// EXPORTAÇÕES ESSENCIAIS (O que estava a faltar)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
