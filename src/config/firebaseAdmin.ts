import admin from "firebase-admin";
import path from "path";

let app: admin.app.App;

export function getFirebaseAdmin() {
  if (app) return admin;

  const serviceAccountPath = path.join(
    process.cwd(),
    "src/config/firebase-service-account.json"
  );

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(serviceAccountPath);

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}