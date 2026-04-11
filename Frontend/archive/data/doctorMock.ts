export interface DoctorSummary {
  totalScreenings: number;
  abnormalCases: number;
  pendingReviews: number;
}

export interface ScreeningCase {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  prediction: string;
  probability: string;
  status: "pending" | "reviewed";
  abnormal: boolean;
  notes?: string;
  gradCamReady?: boolean;
}

export const doctorSummary: DoctorSummary = {
  totalScreenings: 128,
  abnormalCases: 23,
  pendingReviews: 9,
};

export const screeningCases: ScreeningCase[] = [
  {
    id: "SCN-2401",
    patientId: "MQ-4921",
    patientName: "Aarav Singh",
    date: "Feb 6, 2026",
    prediction: "Normal",
    probability: "92%",
    status: "reviewed",
    abnormal: false,
    notes: "No acute findings.",
    gradCamReady: true,
  },
  {
    id: "SCN-2402",
    patientId: "MQ-3810",
    patientName: "Diya Shah",
    date: "Feb 6, 2026",
    prediction: "Abnormal",
    probability: "78%",
    status: "pending",
    abnormal: true,
    gradCamReady: true,
  },
  {
    id: "SCN-2403",
    patientId: "MQ-7754",
    patientName: "Ishaan Verma",
    date: "Feb 5, 2026",
    prediction: "Abnormal",
    probability: "81%",
    status: "pending",
    abnormal: true,
    gradCamReady: false,
  },
  {
    id: "SCN-2404",
    patientId: "MQ-1147",
    patientName: "Mira Patel",
    date: "Feb 5, 2026",
    prediction: "Normal",
    probability: "89%",
    status: "reviewed",
    abnormal: false,
    notes: "Recommend routine follow-up in 12 months.",
    gradCamReady: true,
  },
  {
    id: "SCN-2405",
    patientId: "MQ-5589",
    patientName: "Kabir Nair",
    date: "Feb 4, 2026",
    prediction: "Abnormal",
    probability: "67%",
    status: "pending",
    abnormal: true,
    gradCamReady: true,
  },
];
