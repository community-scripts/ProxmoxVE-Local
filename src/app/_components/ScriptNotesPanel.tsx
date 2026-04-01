"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";

interface ScriptNotesPanelProps {
  slug: string;
}

export function ScriptNotesPanel({ slug }: ScriptNotesPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isShared, setIsShared] = useState(false);

  const { data, refetch } = api.scriptNotes.getBySlug.useQuery({ slug });
  const createMutation = api.scriptNotes.create.useMutation({
    onSuccess: () => {
      resetForm();
      void refetch();
    },
  });
  const updateMutation = api.scriptNotes.update.useMutation({
    onSuccess: () => {
      resetForm();
      void refetch();
    },
  });
  const deleteMutation = api.scriptNotes.delete.useMutation({
    onSuccess: () => void refetch(),
  });

  function resetForm() {
    setIsAdding(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setIsShared(false);
  }

  function startEdit(note: {
    id: number;
    title: string;
    content: string;
    is_shared: boolean;
  }) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsShared(note.is_shared);
    setIsAdding(false);
  }

  function handleSave() {
    if (!content.trim()) return;
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        title,
        content,
        isShared: isShared,
      });
    } else {
      createMutation.mutate({ slug, title, content, isShared: isShared });
    }
  }

  const notes = data?.notes ?? [];
  const isSaving = createMutation.isPending ?? updateMutation.isPending;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground text-base font-semibold sm:text-lg">
          My Notes
        </h3>
        {!isAdding && editingId === null && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <svg
              className="mr-1.5 h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Note
          </Button>
        )}
      </div>

      {/* Add / Edit form */}
      {(isAdding || editingId !== null) && (
        <div className="border-border bg-card mb-4 space-y-3 rounded-lg border p-3">
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1"
            maxLength={200}
          />
          <textarea
            placeholder="Write your note…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary w-full resize-y rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1"
            maxLength={10000}
          />
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="accent-primary h-4 w-4 rounded"
              />
              Share with community
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!content.trim() || isSaving}
              >
                {isSaving ? "Saving…" : editingId !== null ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !isAdding && (
        <p className="text-muted-foreground text-sm">
          No notes yet. Add one to keep track of configuration details or tips.
        </p>
      )}

      <div className="space-y-2">
        {notes.map(
          (note: {
            id: number;
            title: string;
            content: string;
            is_shared: boolean;
            updated_at: Date;
          }) => (
            <div
              key={note.id}
              className="border-border bg-card group rounded-lg border p-3"
            >
              <div className="mb-1 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {note.title && (
                    <h4 className="text-foreground text-sm font-medium">
                      {note.title}
                    </h4>
                  )}
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
                <div className="ml-2 flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {note.is_shared && (
                    <span className="bg-primary/10 text-primary mr-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                      Shared
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(note)}
                    className="text-muted-foreground hover:text-foreground rounded p-1"
                    title="Edit"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      deleteMutation.mutate({ id: note.id });
                    }}
                    className="text-muted-foreground hover:text-destructive rounded p-1"
                    title="Delete"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="text-muted-foreground/60 mt-1 text-[10px]">
                {new Date(note.updated_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
