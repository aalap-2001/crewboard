import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { appUrl, DIGEST_TIMEZONE, SMTP_SECRETS } from "../config";
import { db, FieldValue } from "../lib/firebase";
import type { BoardDoc, TaskDoc, UserDoc } from "../lib/types";
import { sendEmail } from "../email/mailer";
import { digestEmail, type DigestItem } from "../email/messages";

/** Calendar date "YYYY-MM-DD" in the given IANA zone. */
export function dateInZone(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * "Your Crewboard day": every day at 09:00 in DIGEST_TIMEZONE, email each opted-in, active user
 * their assigned tasks that are overdue or due today (not in a done column). Users with nothing
 * due get no email. A marker doc per user per day makes retries safe.
 */
export const dailyDigest = onSchedule(
  { schedule: "0 9 * * *", timeZone: DIGEST_TIMEZONE, secrets: SMTP_SECRETS, timeoutSeconds: 540, retryCount: 1 },
  async () => {
    const tz = DIGEST_TIMEZONE.value();
    const today = dateInZone(tz);
    const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date());
    const users = await db.collection("users").where("active", "==", true).where("notificationPrefs.dailyDigest", "==", true).get();
    const boardNames = new Map<string, string>();
    let sent = 0;

    for (const userSnap of users.docs) {
      const user = userSnap.data() as UserDoc;
      try {
        const tasks = await db
          .collection("tasks")
          .where("assigneeIds", "array-contains", user.uid)
          .where("done", "==", false)
          .where("dueDate", "<=", today)
          .orderBy("dueDate")
          .get();
        if (tasks.empty) continue;

        const marker = db.doc(`_digests/${user.uid}_${today}`);
        try {
          await marker.create({ at: FieldValue.serverTimestamp(), count: tasks.size });
        } catch {
          continue; // already sent today (retry)
        }

        const overdue: DigestItem[] = [];
        const dueToday: DigestItem[] = [];
        for (const t of tasks.docs) {
          const task = t.data() as TaskDoc;
          if (!task.dueDate) continue;
          if (!boardNames.has(task.boardId)) {
            const b = await db.doc(`boards/${task.boardId}`).get();
            boardNames.set(task.boardId, (b.data() as BoardDoc | undefined)?.name ?? "A board");
          }
          const item: DigestItem = {
            title: task.title,
            boardName: boardNames.get(task.boardId)!,
            dueDate: task.dueDate,
            url: appUrl(`/boards/${task.boardId}/tasks/${t.id}`),
          };
          (task.dueDate < today ? overdue : dueToday).push(item);
        }

        await sendEmail(user.email, digestEmail({ name: user.displayName.split(" ")[0], overdue, dueToday, myTasksUrl: appUrl("/my-tasks"), dateLabel }));
        sent++;
      } catch (err) {
        logger.error("Digest failed for user", { uid: user.uid, err });
      }
    }
    logger.info("Daily digest finished", { today, timeZone: tz, candidates: users.size, sent });
  }
);
