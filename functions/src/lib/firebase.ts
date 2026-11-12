import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();

export const auth = getAuth();
export const db = getFirestore();
export { FieldValue, Timestamp };
