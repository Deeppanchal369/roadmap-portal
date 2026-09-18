import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { useCreatePost } from '../hooks/usePosts';
import { Button, Field, Input, Textarea } from './ui/primitives';
import { Dialog, Select } from './ui/overlays';
import type { Post } from '../lib/types';

export function NewRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createPost = useCreatePost();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  function reset() {
    setTitle('');
    setDescription('');
    setCategory(CATEGORIES[0].value);
    setErrors({});
    setFormError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError('');

    try {
      const post = await createPost.mutateAsync({ title, description, category });
      reset();
      onOpenChange(false);
      navigate(`/requests/${(post as Post).slug}`);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details) setErrors(error.details);
        else setFormError(error.message);
      } else {
        setFormError('Could not reach the server. Try again.');
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Suggest a feature"
      description="Describe the problem, not just the fix — it helps others find and upvote it."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="request-title" error={errors.title}>
          <Input
            id="request-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A short, specific summary"
            aria-invalid={Boolean(errors.title)}
            required
          />
        </Field>

        <Field
          label="Description"
          htmlFor="request-description"
          error={errors.description}
          hint="Markdown is supported — lists and **bold** work."
        >
          <Textarea
            id="request-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What's the problem? Who does it affect? What would fix it?"
            rows={5}
            aria-invalid={Boolean(errors.description)}
            required
          />
        </Field>

        <Field label="Category" htmlFor="request-category">
          <Select
            ariaLabel="Category"
            value={category}
            onValueChange={setCategory}
            options={CATEGORIES}
            className="w-full"
          />
        </Field>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={createPost.isPending}>
            Post request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
