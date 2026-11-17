import {
  CarrierForwardingGuide,
  DepartmentRoute,
  IndustryType,
  KnowledgeFAQ,
  OperatingHour,
  ServiceItem,
  VoicePersona,
} from "./types";

export const DEFAULT_OPERATING_HOURS: OperatingHour[] = [
  { day: "Monday", openTime: "09:00", closeTime: "18:00", isClosed: false },
  { day: "Tuesday", openTime: "09:00", closeTime: "18:00", isClosed: false },
  { day: "Wednesday", openTime: "09:00", closeTime: "18:00", isClosed: false },
  { day: "Thursday", openTime: "09:00", closeTime: "19:00", isClosed: false },
  { day: "Friday", openTime: "09:00", closeTime: "19:00", isClosed: false },
  { day: "Saturday", openTime: "09:00", closeTime: "17:00", isClosed: false },
  { day: "Sunday", openTime: "10:00", closeTime: "16:00", isClosed: true },
];

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: "v-sophia",
    name: "Sophia",
    gender: "Female",
    accent: "American",
    tone: "Friendly & Warm — Ideal for Salons, Spas & Hospitality",
    previewText:
      "Hi! Thank you for calling Luxe Hair & Color Lounge. This is Sophia, how can I brighten your day?",
  },
  {
    id: "v-maya",
    name: "Maya",
    gender: "Female",
    accent: "British",
    tone: "Empathetic & Caring — Ideal for Medical & Dental Clinics",
    previewText:
      "Hello, thank you for calling Apex Family Dental. Maya speaking, how may I assist with your care today?",
  },
  {
    id: "v-marcus",
    name: "Marcus",
    gender: "Male",
    accent: "American",
    tone: "Polite & Formal — Ideal for Law Firms & Financial Advisory",
    previewText:
      "Good afternoon, you have reached Vanguard Legal Partners. How may I direct your inquiry?",
  },
  {
    id: "v-liam",
    name: "Liam",
    gender: "Male",
    accent: "Australian",
    tone: "Energetic & Upbeat — Ideal for Travel Agencies & Real Estate",
    previewText:
      "G'day! Thanks for calling Horizon Odyssey Journeys. Ready to plan your next getaway?",
  },
  {
    id: "v-arjun",
    name: "Arjun",
    gender: "Male",
    accent: "Sri Lankan / Indian",
    tone: "Warm & Hospitable — Trusted for South Asian & UK Customer Care",
    previewText:
      "Hello and welcome! This is Arjun, your AI receptionist. How can I help schedule your visit today?",
  },
];

export interface IndustryTemplateData {
  label: string;
  icon: string;
  defaultBusinessName: string;
  defaultVoiceId: string;
  defaultServices: ServiceItem[];
  defaultDepartments: DepartmentRoute[];
  defaultFaqs: KnowledgeFAQ[];
}

export const INDUSTRY_TEMPLATES: Record<IndustryType, IndustryTemplateData> = {
  salon: {
    label: "Hair Salon & Spa",
    icon: "💇‍♀️",
    defaultBusinessName: "Luxe Hair & Color Lounge",
    defaultVoiceId: "v-sophia",
    defaultServices: [
      {
        id: "srv_salon_1",
        name: "Women's Cut & Signature Blowout",
        staffMember: "Sarah / Elena",
        price: 65,
        durationMinutes: 45,
        description:
          "Includes deep cleansing wash, custom cut, and styled blowout.",
      },
      {
        id: "srv_salon_2",
        name: "Full Balayage & Highlights",
        staffMember: "Elena (Master Colorist)",
        price: 185,
        durationMinutes: 120,
        description:
          "Hand-painted dimensional blonde/caramel tones with gloss toner.",
      },
      {
        id: "srv_salon_3",
        name: "Men's Precision Cut & Style",
        staffMember: "Jake",
        price: 35,
        durationMinutes: 30,
        description:
          "Detailed fade or scissor cut, scalp massage, and styling.",
      },
      {
        id: "srv_salon_4",
        name: "Brazilian Keratin Smoothing",
        staffMember: "Sarah",
        price: 160,
        durationMinutes: 90,
        description:
          "Eliminates frizz and creates mirror shine lasting 3–4 months.",
      },
    ],
    defaultDepartments: [
      {
        id: "dept_salon_1",
        name: "Salon Front Desk",
        phoneNumber: "+1 (415) 392-8810",
        description:
          "Transfer when caller asks for bridal group bookings or front desk coordinator.",
      },
      {
        id: "dept_salon_2",
        name: "Owner / VIP Escalation",
        phoneNumber: "+1 (415) 392-8899",
        description:
          "Transfer for urgent complaints or VIP stylist requests.",
      },
    ],
    defaultFaqs: [
      {
        id: "faq_salon_1",
        question: "What is your cancellation policy?",
        answer:
          "We kindly ask for 24 hours notice for cancellations or reschedules to avoid a 50% deposit fee.",
        category: "policy",
      },
      {
        id: "faq_salon_2",
        question: "Where can I park?",
        answer:
          "We offer free dedicated client parking directly behind the salon on 4th Avenue, plus 2-hour street parking out front.",
        category: "parking",
      },
      {
        id: "faq_salon_3",
        question: "Should I wash my hair before a balayage appointment?",
        answer:
          "We recommend arriving with dry hair washed within the last 24 hours without heavy oils.",
        category: "general",
      },
    ],
  },
  clinic: {
    label: "Medical & Dental Clinic",
    icon: "🦷",
    defaultBusinessName: "Apex Family Dental & Wellness",
    defaultVoiceId: "v-maya",
    defaultServices: [
      {
        id: "srv_clinic_1",
        name: "Comprehensive Dental Exam & Cleaning",
        staffMember: "Dr. Harrison / Hygienist Amy",
        price: 120,
        durationMinutes: 60,
        description:
          "Digital X-rays, plaque scaling, polish, and dentist examination.",
      },
      {
        id: "srv_clinic_2",
        name: "Emergency Toothache Consultation",
        staffMember: "On-Duty Dentist",
        price: 95,
        durationMinutes: 30,
        description:
          "Immediate diagnosis and pain relief for urgent oral conditions.",
      },
      {
        id: "srv_clinic_3",
        name: "In-Office Laser Teeth Whitening",
        staffMember: "Hygienist Amy",
        price: 250,
        durationMinutes: 45,
        description: "Laser-accelerated professional enamel brightening.",
      },
    ],
    defaultDepartments: [
      {
        id: "dept_clinic_1",
        name: "Clinical Triage Nurse",
        phoneNumber: "+1 (415) 842-1011",
        description:
          "Transfer immediately if caller reports severe bleeding, trauma, or post-op fever.",
      },
      {
        id: "dept_clinic_2",
        name: "Billing & Dental Insurance",
        phoneNumber: "+1 (415) 842-1022",
        description:
          "Transfer for insurance pre-authorizations and copay inquiries.",
      },
    ],
    defaultFaqs: [
      {
        id: "faq_clinic_1",
        question: "Do you accept Delta Dental and MetLife insurance?",
        answer:
          "Yes! We are in-network with Delta Dental, MetLife, Cigna, and Guardian, and we file claims directly.",
        category: "pricing",
      },
      {
        id: "faq_clinic_2",
        question: "What should I do for a dental emergency?",
        answer:
          "We hold early morning emergency slots every day at 8:30 AM, or I can connect you to our triage nurse right away.",
        category: "policy",
      },
    ],
  },
  travel: {
    label: "Travel Agency & Tours",
    icon: "✈️",
    defaultBusinessName: "Horizon Odyssey Journeys",
    defaultVoiceId: "v-liam",
    defaultServices: [
      {
        id: "srv_travel_1",
        name: "Custom Honeymoon & Holiday Itinerary Consult",
        staffMember: "Senior Travel Planner",
        price: 0,
        durationMinutes: 45,
        description:
          "Complimentary 45-minute discovery session for tailor-made international travel.",
      },
      {
        id: "srv_travel_2",
        name: "Corporate Group Travel Booking",
        staffMember: "Corporate Desk",
        price: 50,
        durationMinutes: 30,
        description:
          "Flight blocks, hotel room allocations, and conference transfers.",
      },
    ],
    defaultDepartments: [
      {
        id: "dept_travel_1",
        name: "24/7 Emergency Flight Rebooking",
        phoneNumber: "+1 (415) 710-4491",
        description: "Transfer when traveler has a delayed or cancelled flight.",
      },
    ],
    defaultFaqs: [
      {
        id: "faq_travel_1",
        question: "Do you charge a fee for vacation consultations?",
        answer:
          "Initial 45-minute itinerary discovery consultations are 100% complimentary!",
        category: "pricing",
      },
    ],
  },
  legal: {
    label: "Legal & Consulting Firm",
    icon: "⚖️",
    defaultBusinessName: "Vanguard Legal Partners",
    defaultVoiceId: "v-marcus",
    defaultServices: [
      {
        id: "srv_legal_1",
        name: "Initial Case Intake & Legal Consultation",
        staffMember: "Partner Attorney",
        price: 150,
        durationMinutes: 30,
        description:
          "Confidential case evaluation for corporate, IP, or litigation matters.",
      },
    ],
    defaultDepartments: [
      {
        id: "dept_legal_1",
        name: "Senior Intake Paralegal",
        phoneNumber: "+1 (415) 601-3310",
        description:
          "Transfer for urgent court filing deadlines or existing client case updates.",
      },
    ],
    defaultFaqs: [
      {
        id: "faq_legal_1",
        question: "Are our phone discussions confidential?",
        answer:
          "Yes, all communications with Vanguard Legal Partners are strictly covered by preliminary attorney-client confidentiality.",
        category: "policy",
      },
    ],
  },
  custom: {
    label: "Custom Business",
    icon: "🏢",
    defaultBusinessName: "My Business Reception",
    defaultVoiceId: "v-sophia",
    defaultServices: [
      {
        id: "srv_custom_1",
        name: "Standard Consultation Appointment",
        staffMember: "Lead Specialist",
        price: 75,
        durationMinutes: 30,
        description: "30-minute consultation booked directly onto your calendar.",
      },
    ],
    defaultDepartments: [
      {
        id: "dept_custom_1",
        name: "Main Reception Desk",
        phoneNumber: "+1 (415) 601-2000",
        description: "Transfer when caller requests a live human representative.",
      },
    ],
    defaultFaqs: [
      {
        id: "faq_custom_1",
        question: "What are your cancellation terms?",
        answer:
          "Please let us know at least 24 hours in advance if you need to reschedule.",
        category: "policy",
      },
    ],
  },
};

export const CARRIER_FORWARDING_CODES: CarrierForwardingGuide[] = [
  {
    id: "dialog_sl",
    name: "Dialog Axiata",
    country: "Sri Lanka",
    forwardAll: "*21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "*61*{AI_NUMBER}#",
    cancelForwarding: "#002#",
  },
  {
    id: "mobitel_sl",
    name: "Mobitel",
    country: "Sri Lanka",
    forwardAll: "*21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "*67*{AI_NUMBER}#",
    cancelForwarding: "##002#",
  },
  {
    id: "slt_fixed",
    name: "SLT-Mobitel Landline",
    country: "Sri Lanka",
    forwardAll: "*21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "*61*{AI_NUMBER}#",
    cancelForwarding: "#21#",
  },
  {
    id: "att_us",
    name: "AT&T Wireless",
    country: "United States",
    forwardAll: "*21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "*61*{AI_NUMBER}#",
    cancelForwarding: "##004#",
  },
  {
    id: "verizon_us",
    name: "Verizon Wireless",
    country: "United States",
    forwardAll: "*72{AI_NUMBER}",
    forwardBusyNoAnswer: "*71{AI_NUMBER}",
    cancelForwarding: "*73",
  },
  {
    id: "tmobile_us",
    name: "T-Mobile US",
    country: "United States",
    forwardAll: "**21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "**61*{AI_NUMBER}**20#",
    cancelForwarding: "##004#",
  },
  {
    id: "telstra_au",
    name: "Telstra",
    country: "Australia",
    forwardAll: "*21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "*61*{AI_NUMBER}#",
    cancelForwarding: "#21#",
  },
  {
    id: "vodafone_uk",
    name: "Vodafone UK",
    country: "United Kingdom",
    forwardAll: "**21*{AI_NUMBER}#",
    forwardBusyNoAnswer: "**61*{AI_NUMBER}#",
    cancelForwarding: "##002#",
  },
];
