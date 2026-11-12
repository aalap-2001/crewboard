import { useCallback } from "react";
import { useSignedIn } from "@/auth/AuthProvider";
import { updateTask, type TaskPatch } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { useToast } from "@/components/Toast";

/** Saves a task patch; surfaces failures as a toast. Resolves true on success. */
export function useTaskUpdate(taskId: string) {
  const { user } = useSignedIn();
  const toast = useToast();
  return useCallback(
    async (patch: TaskPatch) => {
      try {
        await updateTask(user.uid, taskId, patch);
        return true;
      } catch (err) {
        toast(errorMessage(err), "error");
        return false;
      }
    },
    [user.uid, taskId, toast]
  );
}
