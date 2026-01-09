import { z } from "zod";
import type { BranchEmployee, EmployeeSetting } from "@shared/schema";

export const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "terminated", label: "منتهي" },
  { value: "on_leave", label: "في إجازة" },
];

export const HEALTH_CERT_OPTIONS = [
  { value: "none", label: "لا يوجد" },
  { value: "valid", label: "ساري" },
  { value: "expired", label: "منتهي" },
  { value: "pending", label: "قيد التجديد" },
];

export const employeeFormSchema = z.object({
  branchId: z.string().min(1, "الفرع مطلوب"),
  employeeName: z.string().min(1, "اسم الموظف مطلوب"),
  employeeNameEn: z.string().optional(),
  jobTitle: z.string().min(1, "الوظيفة مطلوبة"),
  department: z.string().optional(),
  nationality: z.string().min(1, "الجنسية مطلوبة"),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون رقم موجب"),
  housingAllowance: z.coerce.number().min(0).optional(),
  transportAllowance: z.coerce.number().min(0).optional(),
  foodAllowance: z.coerce.number().min(0).optional(),
  otherAllowances: z.coerce.number().min(0).optional(),
  socialInsuranceDeduction: z.coerce.number().min(0).optional(),
  hireDate: z.string().optional(),
  healthCertificate: z.string().optional(),
  healthCertificateExpiry: z.string().optional(),
  iqamaNumber: z.string().optional(),
  iqamaExpiry: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  phoneNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  status: z.string().default("active"),
  contractType: z.string().optional(),
  workPermitNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;

export interface EmployeeStats {
  totalEmployees: number;
  totalSalaries: number;
  byNationality: Array<{ nationality: string; count: number }>;
  byJobTitle: Array<{ jobTitle: string; count: number }>;
  byBranch: Array<{ branchId: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

export interface Branch {
  id: string;
  name: string;
}

export interface SettingsByCategory {
  nationality?: EmployeeSetting[];
  job_title?: EmployeeSetting[];
  department?: EmployeeSetting[];
  contract_type?: EmployeeSetting[];
  bank?: EmployeeSetting[];
  [key: string]: EmployeeSetting[] | undefined;
}

export interface EmployeeFiltersState {
  selectedBranch: string;
  selectedNationality: string;
  selectedJobTitle: string;
  selectedStatus: string;
  searchQuery: string;
  salaryMin?: number;
  salaryMax?: number;
  hireDateFrom?: string;
  hireDateTo?: string;
}

export type { BranchEmployee, EmployeeSetting };
