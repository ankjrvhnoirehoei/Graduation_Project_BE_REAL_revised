import * as admin from 'firebase-admin';
import { firebaseServiceAccount } from './config/firebase-adminsdk';

admin.initializeApp({
  credential: admin.credential.cert(
    firebaseServiceAccount as admin.ServiceAccount,
  ),
});

export default admin;
