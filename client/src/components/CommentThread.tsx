import { Pencil, Reply, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCreateComment, useDeleteComment, useUpdateComment } from '../hooks/usePosts';
import { MAX_COMMENT_DEPTH } from '../lib/constants';
import type { CommentNode } from '../lib/types';
import { formatRelativeTime } from '../lib/utils';
import { Avatar, Button, Textarea } from './ui/primitives';

export function CommentThread({ postId, comments }: { postId: string; comments: CommentNode[] }) {
  const { requireAuth } = useAuth();
  const [replyBoxOpen, setReplyBoxOpen] = useState<string | null>(null);
  const createComment = useCreateComment(postId);

  const [topLevelBody, setTopLevelBody] = useState('');

  async function submitTopLevel(event: React.FormEvent) {
    event.preventDefault();
    if (!requireAuth('to comment')) return;
    const body = topLevelBody.trim();
    if (!body) return;
    await createComment.mutateAsync({ body });
    setTopLevelBody('');
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submitTopLevel} className="space-y-2">
        <Textarea
          value={topLevelBody}
          onChange={(event) => setTopLevelBody(event.target.value)}
          placeholder="Add to the discussion…"
          rows={3}
          onFocus={() => requireAuth('to comment')}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={createComment.isPending} disabled={!topLevelBody.trim()}>
            Comment
          </Button>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet — be the first to weigh in.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              postId={postId}
              comment={comment}
              replyBoxOpen={replyBoxOpen}
              setReplyBoxOpen={setReplyBoxOpen}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({
  postId,
  comment,
  replyBoxOpen,
  setReplyBoxOpen,
}: {
  postId: string;
  comment: CommentNode;
  replyBoxOpen: string | null;
  setReplyBoxOpen: (id: string | null) => void;
}) {
  const { user, requireAuth } = useAuth();
  const createComment = useCreateComment(postId);
  const updateComment = useUpdateComment(postId);
  const deleteComment = useDeleteComment(postId);

  const [replyBody, setReplyBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  const isAuthor = user?.id === comment.author?.id;
  const canModerate = isAuthor || user?.role === 'admin';
  const isReplying = replyBoxOpen === comment.id;
  const canReply = comment.depth < MAX_COMMENT_DEPTH;

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    if (!requireAuth('to reply')) return;
    const body = replyBody.trim();
    if (!body) return;
    await createComment.mutateAsync({ body, parentId: comment.id });
    setReplyBody('');
    setReplyBoxOpen(null);
  }

  async function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    const body = editBody.trim();
    if (!body) return;
    await updateComment.mutateAsync({ id: comment.id, body });
    setEditing(false);
  }

  return (
    <li className="space-y-3">
      <div className="flex gap-3">
        <Avatar
          name={comment.author?.name ?? 'Deleted user'}
          src={comment.author?.avatarUrl}
          className="size-7 shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-medium">{comment.isDeleted ? 'Deleted' : comment.author?.name}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
            {comment.editedAt ? <span className="text-xs text-muted-foreground">· edited</span> : null}
          </div>

          {editing ? (
            <form onSubmit={submitEdit} className="space-y-2">
              <Textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={3} autoFocus />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={updateComment.isPending}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className={comment.isDeleted ? 'text-sm italic text-muted-foreground' : 'text-sm'}>
              {comment.body}
            </p>
          )}

          {!comment.isDeleted && !editing ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {canReply ? (
                <button
                  onClick={() => {
                    if (!requireAuth('to reply')) return;
                    setReplyBoxOpen(isReplying ? null : comment.id);
                  }}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Reply className="size-3.5" />
                  Reply
                </button>
              ) : null}
              {isAuthor ? (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 hover:text-foreground">
                  <Pencil className="size-3.5" />
                  Edit
                </button>
              ) : null}
              {canModerate ? (
                <button
                  onClick={() => deleteComment.mutate(comment.id)}
                  className="flex items-center gap-1 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}

          {isReplying ? (
            <form onSubmit={submitReply} className="space-y-2 pt-1">
              <Textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder={`Reply to ${comment.author?.name ?? 'this comment'}…`}
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={createComment.isPending} disabled={!replyBody.trim()}>
                  Reply
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setReplyBoxOpen(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      {comment.replies.length > 0 ? (
        <ul className="ml-5 space-y-4 border-l border-border pl-5">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              postId={postId}
              comment={reply}
              replyBoxOpen={replyBoxOpen}
              setReplyBoxOpen={setReplyBoxOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
