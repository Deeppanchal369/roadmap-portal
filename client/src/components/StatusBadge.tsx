import { Badge } from './ui/primitives';
import { statusMeta } from '../lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
