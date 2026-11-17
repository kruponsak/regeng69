export type ScreenPath = 'public-portal' | 'login' | 'school-portal' | 'admin-central';

export type TransitionType = 'push' | 'push_back' | 'none';

export const SCREEN_TITLES: Record<ScreenPath, string> = {
  'public-portal': 'รายการแข่งขันและกำหนดการ (บุคคลทั่วไป) - ศิลปหัตถกรรมฯ ครั้งที่ 74',
  'login': 'เข้าสู่ระบบ - งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74',
  'school-portal': 'ระบบลงทะเบียนรายการแข่งขัน (แอดมินโรงเรียน) - ศิลปหัตถกรรมฯ ครั้งที่ 74',
  'admin-central': 'จัดการรายการแข่งขัน (ผู้ดูแลระบบ) - ศิลปหัตถกรรมฯ ครั้งที่ 74',
};

export interface SiteSettings {
  siteTitle: string;
  siteSubtitle: string;
  heroHeading: string;
  heroDescription: string;
  footerText: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteTitle: 'ศิลปหัตถกรรมฯ ครั้งที่ 74',
  siteSubtitle: 'งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 · ประกาศรายการแข่งขันและผู้เข้าประกวด',
  heroHeading: 'รายการแข่งขัน กำหนดการ และรายชื่อโรงเรียนที่ลงทะเบียน',
  heroDescription:
    'ตรวจสอบตารางเวลา สถานที่แข่งขัน กิจกรรมหลัก กิจกรรมย่อย และรายชื่อนักเรียนตัวแทนโรงเรียนที่ส่งเข้าแข่งขัน แยกตามกลุ่มกิจกรรม ระดับชั้น และสถานศึกษา',
  footerText: 'งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 · ระบบจัดการรายการแข่งขันและลงทะเบียน',
};

export type UserRole = 'admin' | 'school';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  schoolName: string; // 'ผู้ดูแลระบบ' for admin, or full school name for school admin
  createdAt: string;
}

export type CompetitionLevel = 'ปฐมวัย' | 'ป.1-3' | 'ป.4-6' | 'ม.1-3';

export const COMPETITION_LEVELS: CompetitionLevel[] = [
  'ปฐมวัย',
  'ป.1-3',
  'ป.4-6',
  'ม.1-3',
];

export interface CompetitionItem {
  id: string;
  categoryGroup: string; // กลุ่มกิจกรรม (required)
  mainActivity: string; // กิจกรรมหลัก (required)
  subActivity?: string; // กิจกรรมย่อย (optional)
  level?: CompetitionLevel | ''; // รุ่นของรายการ (แยกแต่ละรุ่นเป็น 1 รายการ)
  competitionDate?: string; // วัน (optional)
  competitionTime?: string; // เวลา (optional)
  venue?: string; // สถานที่ (optional)
  updatedAt: string;
}

export const STUDENT_PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'] as const;

export const STUDENT_GRADES = [
  'อนุบาล 1',
  'อนุบาล 2',
  'อนุบาล 3',
  'ป.1',
  'ป.2',
  'ป.3',
  'ป.4',
  'ป.5',
  'ป.6',
  'ม.1',
  'ม.2',
  'ม.3',
] as const;

export const DEFAULT_CATEGORY_GROUPS = [
  'ภาษาไทย',
  'คณิตศาสตร์',
  'วิทยาศาสตร์และเทคโนโลยี',
  'สังคมศึกษา ศาสนา และวัฒนธรรม',
  'ศิลปะ-ทัศนศิลป์',
  'ศิลปะ-ดนตรี',
  'ศิลปะ-นาฏศิลป์',
  'การงานอาชีพ',
  'ภาษาต่างประเทศ',
  'กิจกรรมพัฒนาผู้เรียน',
  'การศึกษาปฐมวัย',
] as const;

export interface StudentEntry {
  title: string; // คำนำหน้า
  fullName: string; // ชื่อ-สกุล
  grade: string; // ชั้นปี
}

export interface RegistrationRecord {
  id: string;
  competitionId: string;
  categoryGroup: string;
  mainActivity: string;
  subActivity?: string;
  level: CompetitionLevel; // รุ่น (จำเป็น)
  schoolName: string; // โรงเรียนตาม user แอดมินโรงเรียน
  advisors: string[]; // ชื่อครูที่ปรึกษา (ไม่บังคับ)
  students: StudentEntry[]; // นักเรียน (ไม่บังคับ)
  submittedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmationState {
  isOpen: boolean;
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  tone: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

export type ActivityLogAction = 'create' | 'update' | 'delete';

export type ActivityLogTargetType =
  | 'competition'
  | 'category'
  | 'user'
  | 'registration'
  | 'settings';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actorUsername: string;
  actorName: string;
  actorRole: UserRole;
  action: ActivityLogAction;
  targetType: ActivityLogTargetType;
  targetId: string;
  targetTitle: string;
  summary: string;
  details: string[];
}

export interface SheetLinkEntry {
  id: string;
  label: string;
  spreadsheetId: string;
  sheetUrl: string;
  gasUrl: string;
  lastActivatedAt: number;
}

export interface ActiveSheetConfig {
  spreadsheetId: string;
  sheetUrl: string;
  gasUrl: string;
  label: string;
  lastActivatedAt: number;
}

export function isRegistrationComplete(
  reg: Pick<RegistrationRecord, 'advisors' | 'students'>
): boolean {
  const hasAdvisor =
    Array.isArray(reg.advisors) && reg.advisors.some((a) => a.trim() !== '');
  const hasStudent =
    Array.isArray(reg.students) &&
    reg.students.some((s) => s.fullName.trim() !== '');
  return hasAdvisor && hasStudent;
}
