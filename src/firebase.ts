import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDuGyOAB7_jBbsbMrmunxsuTIharKLoFR0",
  authDomain: "projeto-tg-edef9.firebaseapp.com",
  projectId: "projeto-tg-edef9",
  storageBucket: "projeto-tg-edef9.firebasestorage.app",
  messagingSenderId: "882195229531",
  appId: "1:882195229531:web:47c3bb3241b4569f92887e",
  // measurementId só é necessário se for usar Analytics
  // measurementId: "G-BTQ8LTE25R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exportando os serviços que vamos usar
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;