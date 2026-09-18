import type { CategoryValue, StatusValue } from './constants';

export interface PublicUser {
  id: string;
  _id?: string;
  name: string;
  email?: string;
  avatarUrl: string;
  role: 'user' | 'admin';
  isEmailVerified?: boolean;
  createdAt?: string;
}

export interface StatusChange {
  from: StatusValue;
  to: StatusValue;
  changedBy: string;
  note: string;
  changedAt: string;
}

export interface Post {
  _id: string;
  id?: string;
  title: string;
  slug: string;
  description: string;
  category: CategoryValue;
  status: StatusValue;
  author: PublicUser | null;
  voteCount: number;
  commentCount: number;
  hasVoted: boolean;
  statusHistory: StatusChange[];
  statusActors?: PublicUser[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentNode {
  id: string;
  body: string;
  depth: number;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  author: PublicUser | null;
  parent: string | null;
  replies: CommentNode[];
}

export type RoadmapColumns = Record<'planned' | 'in_progress' | 'completed', Post[]>;
