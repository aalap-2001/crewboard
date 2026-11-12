import { setGlobalOptions } from "firebase-functions/v2";
import { REGION } from "./config";

setGlobalOptions({ region: REGION, maxInstances: 10 });

// Phase 1 — users & auth
export { inviteUser, resendInvite, setUserRole, setUserActive } from "./users/admin";
export { requestPasswordReset } from "./auth/passwordReset";

// Phase 2 — boards & tasks
export { onBoardWritten, onColumnUpdated } from "./boards/triggers";
export { onTaskWritten, onCommentWritten } from "./tasks/triggers";

// Phase 3 — notifications
export { onNotificationCreated } from "./notifications/email";

// Phase 4 — daily digest
export { dailyDigest } from "./digest/daily";
