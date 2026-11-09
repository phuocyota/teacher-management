export type GoldenBellStudent = {
  id: string;
  name: string;
  status?: 'active' | 'passed' | 'eliminated';
  joinedAt?: string;
  lastQuestionNo?: number;
  correctCount?: number;
  wrongCount?: number;
  eliminatedReason?: 'wrong-answer' | 'timeout' | null;
  eliminatedAt?: string | null;
  eliminatedQuestionNo?: number | null;
  resumeFromQuestionNo?: number;
  revivedAt?: string;
  revivalCount?: number;
};

export type GoldenBellRoom = {
  roomId?: string;
  code?: string;
  questionBankId?: string;
  currentQuestion?: unknown;
  questionNo?: number;
  usedQuestionIds?: string[];
  students?: GoldenBellStudent[];
  questionStartedAt?: string;
  questionDurationSeconds?: number;
  questionEndedAt?: string | null;
  status?: 'WAITING' | 'RUNNING' | 'FINISHED' | 'EXPIRED';
  createdAt?: string;
  expiresAt?: string;
  endedAt?: string | null;
  podiumSelections?: Record<string, string>;
};

export type GoldenBellCreateRoomPayload = {
  questionBankId?: string;
};

export type GoldenBellJoinPayload = {
  roomId?: string;
  student?: GoldenBellStudent;
  initialRoom?: GoldenBellRoom;
};

export type GoldenBellSyncPayload = {
  roomId?: string;
  room?: GoldenBellRoom;
};

export type GoldenBellEndRoomPayload = {
  roomId?: string;
};

export type GoldenBellReviveStudentPayload = {
  roomId?: string;
  studentId?: string;
};
