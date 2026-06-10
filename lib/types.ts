export type CompetitionStatus =
  | 'Draft'
  | 'Submissions Open'
  | 'Submissions Closed'
  | 'Judging Live'
  | 'Judging Locked'
  | 'Finalized'
  | 'Archived';

export type ModerationStatus =
  | 'Pending'
  | 'Playback Verified'
  | 'Approved'
  | 'Rejected';

export interface JudgeSlot {
  id: string;
  code: string;
  pin: string;
  label: string;
  isActive: boolean;
}

export interface EntryRecord {
  id: string;
  entrantName: string;
  entrantEmail: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  notes?: string | null;
  moderationStatus: ModerationStatus;
  runningOrder?: number | null;
}

export interface ScoreRecord {
  id: string;
  entryId: string;
  judgeSlotId: string;
  score: number;
  updatedAt: string;
}
