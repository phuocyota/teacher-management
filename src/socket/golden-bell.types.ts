export type GoldenBellStudent = {
  id: string;
  name: string;
  status?: 'active' | 'passed' | 'eliminated';
  joinedAt?: string;
  lastQuestionNo?: number;
  correctCount?: number;
  wrongCount?: number;
};

export type GoldenBellRoom = {
  roomId?: string;
  code?: string;
  questionBankId?: string;
  currentQuestion?: unknown;
  questionNo?: number;
  usedQuestionIds?: string[];
  students?: GoldenBellStudent[];
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
