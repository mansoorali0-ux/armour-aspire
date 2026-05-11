import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, updateDoc, onSnapshot, orderBy, query } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFzBY0bOMWqxdpJTeyXlzahtJ_84gHf8k",
  authDomain: "sac-app-dcf1e.firebaseapp.com",
  projectId: "sac-app-dcf1e",
  storageBucket: "sac-app-dcf1e.firebasestorage.app",
  messagingSenderId: "680691879055",
  appId: "1:680691879055:web:8a15c7b13f0448cf3534fa"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Save a game (create or update)
export async function saveGame(game) {
  const id = game.id || (game.date.replace(/\//g,"-") + "-" + game.opponent.slice(0,10).replace(/\s/g,"-")).toLowerCase();
  const gameWithId = { ...game, id };
  await setDoc(doc(db, "games", id), gameWithId);
  return gameWithId;
}

// Load all games
export async function loadGames() {
  const q = query(collection(db, "games"), orderBy("date"));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// Listen to games in real time
export function listenToGames(callback) {
  const q = query(collection(db, "games"));
  return onSnapshot(q, snap => {
    const games = snap.docs.map(d => d.data());
    games.sort((a,b) => new Date(a.date) - new Date(b.date));
    callback(games);
  });
}

// Update a specific game
export async function updateGame(game) {
  await setDoc(doc(db, "games", game.id), game);
}
