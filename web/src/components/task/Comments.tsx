import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useSignedIn } from "@/auth/AuthProvider";
import { addComment, deleteComment, editComment, watchComments } from "@/lib/firestore";
import { errorMessage } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { parseMentions } from "@/lib/mentions";
import type { CommentDoc, TaskDoc } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { useToast } from "@/components/Toast";
import { Button, Spinner } from "@/components/ui";
import { useBoard } from "@/components/board/BoardContext";
import { MarkdownEditor } from "./Description";

function CommentItem({ comment, task }: { comment: CommentDoc; task: TaskDoc }) {
  const taskId = task.id;
  const { user } = useSignedIn();
  const { usersById, members } = useBoard();
  const toast = useToast();
  const author = usersById.get(comment.authorId);
  const mine = comment.authorId === user.uid;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    try {
      await editComment(taskId, comment.id, draft.trim(), parseMentions(draft, task.memberIds));
      setEditing(false);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <li className="flex gap-3">
      <Avatar name={author?.displayName ?? "?"} url={author?.avatarUrl} seed={comment.authorId} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold text-slate-900 dark:text-white">{author?.displayName ?? "Former teammate"}</span>{" "}
          <span className="text-xs text-slate-500">
            {relativeTime(comment.createdAt)}
            {comment.edited && " · edited"}
          </span>
        </p>
        {editing ? (
          <div className="mt-1.5">
            <MarkdownEditor label="Edit comment" value={draft} onChange={setDraft} rows={3} autoFocus people={members} onSubmitShortcut={() => void save()} />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setDraft(comment.body); setEditing(false); }}>Cancel</Button>
              <Button size="sm" disabled={!draft.trim() || draft.trim() === comment.body} onClick={() => void save()}>Save comment</Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <Markdown>{comment.body}</Markdown>
          </div>
        )}
        {mine && !editing && (
          <div className="mt-1 flex gap-3 text-xs font-semibold text-slate-500">
            <button className="hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setEditing(true)}>Edit</button>
            {confirming ? (
              <>
                <button className="text-red-600 hover:text-red-700" onClick={() => void deleteComment(taskId, comment.id).catch((e) => toast(errorMessage(e), "error"))}>
                  Confirm delete
                </button>
                <button onClick={() => setConfirming(false)}>Keep</button>
              </>
            ) : (
              <button className="hover:text-red-600" onClick={() => setConfirming(true)}>Delete</button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function Comments({ task }: { task: TaskDoc }) {
  const { user, profile } = useSignedIn();
  const { members } = useBoard();
  const toast = useToast();
  const [comments, setComments] = useState<CommentDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => watchComments(task.id, setComments, (e) => setError(errorMessage(e))), [task.id]);

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      await addComment(user.uid, task.id, body, parseMentions(body, task.memberIds));
      setDraft("");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">Comments couldn't load: {error}</p>
      ) : !comments ? (
        <Spinner />
      ) : comments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><MessageSquare className="h-4 w-4" aria-hidden /> No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => <CommentItem key={c.id} comment={c} task={task} />)}
        </ul>
      )}
      <div className="mt-5 flex gap-3">
        <Avatar name={profile.displayName} url={profile.avatarUrl} seed={profile.uid} size="sm" />
        <div className="min-w-0 flex-1">
          <MarkdownEditor label="Write a comment" value={draft} onChange={setDraft} rows={3} placeholder="Write a comment… Type @ to mention someone, or @all for everyone" people={members} onSubmitShortcut={() => void post()} />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">Ctrl/⌘ + Enter to post</span>
            <Button size="sm" loading={busy} disabled={!draft.trim()} onClick={() => void post()}>Post comment</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
