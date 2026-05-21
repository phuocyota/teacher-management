export interface ReportStudentRow {
  id: string;
  fullName: string | null;
  userName: string;
  code: string;
  studentGroupId: string | null;
  studentGroupName: string | null;
}

export interface SchoolAttemptReportFilters {
  examSetId?: string;
  questionBankId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface SchoolReportAccessScope {
  groupIds?: string[];
}

export interface StudentReportFilters {
  zoneId?: string;
  schoolId?: string;
  groupId?: string;
  studentId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface SchoolAttemptReportRow {
  studentId: string;
  fullName: string | null;
  userName: string;
  studentCode: string;
  studentGroupId: string;
  studentGroupName: string;
  totalAttempts: string;
  averageScore: string | null;
  highestScore: string | null;
  latestAttemptAt: Date | null;
}

export interface ClassAttemptScoreExportRow {
  studentId: string;
  studentCode: string;
  fullName: string | null;
  userName: string;
  attemptId: string | null;
  examSetId: string | null;
  examSetName: string | null;
  questionBankId: string | null;
  questionBankName: string | null;
  status: string | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  score: string | number | null;
}

export interface StudentAttemptDetailRow {
  orderNo: number;
  isCorrect: boolean | null;
  pointsEarned: string | number | null;
}

export interface StudentAttemptScoreStats {
  attemptCount: number;
  highestScore: number | null;
  lowestScore: number | null;
  averageScore: number | null;
}

export interface StudentAttemptDetailContext {
  attemptId: string;
  score: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  studentId: string;
  studentCode: string;
  studentFullName: string | null;
  studentUserName: string;
  groupId: string | null;
  groupName: string | null;
  schoolName: string | null;
  examSetName: string | null;
  questionBankName: string | null;
  questionBankId: string;
}

export interface ClassSheetRawRow {
  studentId: string;
  studentCode: string;
  fullName: string | null;
  userName: string;
  attemptId: string | null;
  examSetName: string | null;
  questionBankName: string | null;
  subjectName: string | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  score: string | number | null;
}

export interface ClassSheetRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  subjectName: string;
  correctCount: number;
  score: number | null;
  resultLabel: string;
  startedAt: Date | null;
}

export interface SchoolStatRawRow {
  studentId: string;
  studentCode: string;
  studentGroupId: string;
  studentGroupName: string;
  fullName: string | null;
  userName: string;
  attemptId: string | null;
  score: string | number | null;
  startedAt: Date | null;
}

export interface SchoolStatRow {
  groupId: string;
  groupName: string;
  totalStudents: number;
  attemptedStudents: number;
  absentStudents: number;
  highestScore: number | null;
  lowestScore: number | null;
  underFiveCount: number;
  averageScore: number | null;
  passRate: number;
  ranking: number | null;
  assessment: string;
}

export interface ZoneStatRawRow extends SchoolStatRawRow {
  schoolId: string;
  schoolName: string;
}

export interface ZoneStatRow {
  schoolId: string;
  schoolName: string;
  totalGroups: number;
  attemptedGroups: number;
  absentGroups: number;
  totalStudents: number;
  attemptedStudents: number;
  absentStudents: number;
  averageScore: number | null;
  completionRate: number;
  assessment: string;
}
