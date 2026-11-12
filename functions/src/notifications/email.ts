import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { appUrl, SMTP_SECRETS } from "../config";
import { db } from "../lib/firebase";
import type { NotificationDoc, UserDoc } from "../lib/types";
import { sendEmail } from "../email/mailer";
import { assignmentEmail, mentionEmail } from "../email/messages";

/** Sends the Crewboard email for a new notification, if the recipient wants it. */
export const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{id}", secrets: SMTP_SECRETS },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const n = snap.data() as NotificationDoc;
    if (n.emailStatus !== "pending") return;

    const [recipientSnap, actorSnap] = await db.getAll(db.doc(`users/${n.recipientId}`), db.doc(`users/${n.actorId}`));
    const recipient = recipientSnap.data() as UserDoc | undefined;
    const actorName = (actorSnap.data() as UserDoc | undefined)?.displayName ?? "A teammate";
    const prefs = recipient?.notificationPrefs;

    const wants =
      !!recipient?.active &&
      !!prefs &&
      ((n.type === "assigned" && prefs.emailOnAssignment) ||
        (n.type === "mentioned" && prefs.emailOnMention) ||
        (n.type === "assigned" && n.alsoMentioned && prefs.emailOnMention));

    if (!wants) {
      await snap.ref.update({ emailStatus: "skipped" });
      return;
    }

    const taskUrl = appUrl(`/boards/${n.boardId}/tasks/${n.taskId}`);
    const email =
      n.type === "assigned"
        ? assignmentEmail({ name: recipient!.displayName, actorName, taskTitle: n.taskTitle, boardName: n.boardName, snippet: n.snippet, alsoMentioned: n.alsoMentioned, taskUrl })
        : mentionEmail({ name: recipient!.displayName, actorName, taskTitle: n.taskTitle, boardName: n.boardName, snippet: n.snippet, inComment: n.source === "comment", taskUrl });

    try {
      await sendEmail(recipient!.email, email);
      await snap.ref.update({ emailStatus: "sent" });
    } catch (err) {
      logger.error("Notification email failed", { id: snap.id, err });
      await snap.ref.update({ emailStatus: "failed" });
    }
  }
);
