export type GoldenBellStudent = {
  id: string;
  name: string;
  status?: 'active' | 'passed' | 'eliminated';
  joinedAt?: string;
  lastQuestionNo?: number;
  correctCount?: number;
  wrongCount?: number;
  eliminatedReason?: 'wrong-answer' | 'timeout';
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
