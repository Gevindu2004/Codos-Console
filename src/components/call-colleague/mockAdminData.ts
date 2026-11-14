import { AppointmentItem, CallLogItem, IndustryType } from "./types";

export const MOCK_CALL_LOGS: CallLogItem[] = [
  {
    id: "call_101",
    callerName: "Jessica Miller",
    callerPhone: "+1 (555) 234-8910",
    timestamp: "12 mins ago",
    duration: "1m 48s",
    status: "booked",
    sentiment: "positive",
    serviceRequested: "Women's Cut & Signature Blowout ($65)",
    summary:
      "Caller asked if Elena or Sarah had an opening tomorrow morning. AI checked Google Calendar, confirmed 11:00 AM with Sarah, and sent SMS confirmation.",
    transcript: [
      {
        role: "agent",
        text: "Hi! Thank you for calling Luxe Hair & Color Lounge. This is Sophia, your AI receptionist. How can I brighten your day?",
      },
      {
        role: "user",
        text: "Hi Sophia! Do you have any openings tomorrow morning for a women's cut and blowout?",
      },
      {
        role: "agent",
        text: "I'd love to check that for you! Our Women's Cut & Signature Blowout is $65 and takes 45 minutes. Sarah has 11:00 AM and 2:30 PM open tomorrow. Would 11:00 AM work?",
      },
      {
        role: "user",
        text: "11:00 AM is perfect! My name is Jessica Miller.",
      },
      {
        role: "agent",
        text: "Wonderful, Jessica! I have locked in your appointment with Sarah for tomorrow at 11:00 AM on our Google Calendar and texted you a confirmation.",
      },
    ],
  },
  {
    id: "call_102",
    callerName: "Emily Watson",
    callerPhone: "+1 (555) 781-4492",
    timestamp: "47 mins ago",
    duration: "2m 15s",
    status: "booked",
    sentiment: "positive",
    serviceRequested: "Full Balayage & Highlights ($185)",
    summary:
      "Caller asked about balayage pricing and whether to wash hair beforehand. AI answered FAQ and booked Friday at 2:00 PM with Elena.",
    transcript: [
      {
        role: "agent",
        text: "Hello, thank you for calling Luxe Hair & Color Lounge! Sophia speaking, how may I help you?",
      },
      {
        role: "user",
        text: "Hi! How much is a full balayage, and should I wash my hair before coming in?",
      },
      {
        role: "agent",
        text: "Our Full Balayage & Highlights with Master Colorist Elena is $185 and takes about 2 hours. We recommend arriving with dry hair washed within the last 24 hours without heavy oils. Elena has Friday at 2:00 PM open—would you like to reserve it?",
      },
      {
        role: "user",
        text: "Yes please! Put it under Emily Watson.",
      },
      {
        role: "agent",
        text: "You're all set for Friday at 2:00 PM with Elena, Emily! Free parking is available right behind our salon on 4th Avenue.",
      },
    ],
  },
  {
    id: "call_103",
    callerName: "Marcus Vance",
    callerPhone: "+1 (555) 902-3118",
    timestamp: "2 hours ago",
    duration: "1m 12s",
    status: "transferred",
    sentiment: "urgent",
    serviceRequested: "Bridal Group Booking -> Warm Transfer to Front Desk",
    summary:
      "Caller requested a custom bridal party package for 6 bridesmaids. AI collected party details and warm-transferred to Salon Front Desk (+1 555-392-8810).",
    transcript: [
      {
        role: "agent",
        text: "Thank you for calling Luxe Hair & Color Lounge! This is Sophia. How can I assist you?",
      },
      {
        role: "user",
        text: "Hi, I need to arrange a wedding party booking for 6 bridesmaids next month. Can I speak with your coordinator?",
      },
      {
        role: "agent",
        text: "Congratulations on the upcoming wedding! For bridal groups of 4 or more, I'll connect you directly to our Salon Front Desk coordinator right now. One moment please!",
      },
    ],
  },
  {
    id: "call_104",
    callerName: "Chloe Bennett",
    callerPhone: "+1 (555) 412-7721",
    timestamp: "4 hours ago",
    duration: "0m 54s",
    status: "completed",
    sentiment: "positive",
    serviceRequested: "Parking & Cancellation Policy Inquiry",
    summary:
      "Caller asked where to park for her afternoon appointment. AI shared the 4th Avenue rear parking lot instructions.",
    transcript: [
      {
        role: "agent",
        text: "Hi there! Luxe Hair & Color Lounge, Sophia speaking. How can I help?",
      },
      {
        role: "user",
        text: "Quick question—where do I park when I arrive today?",
      },
      {
        role: "agent",
        text: "We offer free dedicated client parking directly behind the salon on 4th Avenue, or 2-hour street parking out front!",
      },
    ],
  },
  {
    id: "call_105",
    callerName: "David Chen",
    callerPhone: "+1 (555) 349-1120",
    timestamp: "Yesterday, 4:10 PM",
    duration: "1m 31s",
    status: "booked",
    sentiment: "positive",
    serviceRequested: "Men's Precision Cut & Style ($35)",
    summary:
      "Booked Men's Precision Cut with Jake for Saturday at 10:30 AM.",
    transcript: [
      {
        role: "agent",
        text: "Hello! Luxe Hair & Color Lounge, Sophia speaking.",
      },
      {
        role: "user",
        text: "Can I get a men's cut with Jake on Saturday morning?",
      },
      {
        role: "agent",
        text: "Jake has 10:30 AM available this Saturday for a Men's Precision Cut & Style at $35. Shall I book that for you?",
      },
      {
        role: "user",
        text: "Yes, David Chen please.",
      },
    ],
  },
];

export const MOCK_APPOINTMENTS: AppointmentItem[] = [
  {
    id: "apt_201",
    clientName: "Jessica Miller",
    clientPhone: "+1 (555) 234-8910",
    serviceName: "Women's Cut & Signature Blowout",
    staffMember: "Sarah (Senior Stylist)",
    dateTime: "Tomorrow, 11:00 AM",
    durationMinutes: 45,
    price: 65,
    status: "confirmed",
    bookedVia: "AI Voice Receptionist",
  },
  {
    id: "apt_202",
    clientName: "Emily Watson",
    clientPhone: "+1 (555) 781-4492",
    serviceName: "Full Balayage & Highlights",
    staffMember: "Elena (Master Colorist)",
    dateTime: "Friday, 2:00 PM",
    durationMinutes: 120,
    price: 185,
    status: "confirmed",
    bookedVia: "AI Voice Receptionist",
  },
  {
    id: "apt_203",
    clientName: "David Chen",
    clientPhone: "+1 (555) 349-1120",
    serviceName: "Men's Precision Cut & Style",
    staffMember: "Jake",
    dateTime: "Saturday, 10:30 AM",
    durationMinutes: 30,
    price: 35,
    status: "confirmed",
    bookedVia: "AI Voice Receptionist",
  },
  {
    id: "apt_204",
    clientName: "Rachel Green",
    clientPhone: "+1 (555) 882-9901",
    serviceName: "Brazilian Keratin Smoothing",
    staffMember: "Sarah (Senior Stylist)",
    dateTime: "Thursday, 3:30 PM",
    durationMinutes: 90,
    price: 160,
    status: "confirmed",
    bookedVia: "AI Voice Receptionist",
  },
];

export const DEMO_TENANT_PRESETS: Record<
  "salon" | "clinic",
  {
    businessName: string;
    industry: IndustryType;
    phone: string;
    calls: CallLogItem[];
    appointments: AppointmentItem[];
  }
> = {
  salon: {
    businessName: "Luxe Hair & Color Lounge",
    industry: "salon",
    phone: "+1 (888) 412-9940",
    calls: MOCK_CALL_LOGS,
    appointments: MOCK_APPOINTMENTS,
  },
  clinic: {
    businessName: "Apex Family Dental & Wellness",
    industry: "clinic",
    phone: "+1 (800) 945-7712",
    calls: [
      {
        id: "call_c1",
        callerName: "Robert Martinez",
        callerPhone: "+1 (555) 489-2231",
        timestamp: "8 mins ago",
        duration: "1m 52s",
        status: "booked",
        sentiment: "urgent",
        serviceRequested: "Emergency Toothache Consultation ($95)",
        summary:
          "Patient reported severe molar pain. AI triaged symptoms and booked the 8:30 AM emergency slot tomorrow with Dr. Harrison.",
        transcript: [
          {
            role: "agent",
            text: "Thank you for calling Apex Family Dental & Wellness. Maya speaking, how can we care for your smile today?",
          },
          {
            role: "user",
            text: "Hi Maya, I have terrible throbbing pain in my back molar. Can I see a dentist urgently?",
          },
          {
            role: "agent",
            text: "I'm so sorry you're in pain, Robert. We hold an 8:30 AM emergency consultation slot with Dr. Harrison tomorrow morning for $95. I've reserved that for you and texted pre-visit relief instructions.",
          },
        ],
      },
      {
        id: "call_c2",
        callerName: "Claire Redfield",
        callerPhone: "+1 (555) 773-1992",
        timestamp: "1 hour ago",
        duration: "1m 25s",
        status: "booked",
        sentiment: "positive",
        serviceRequested: "Comprehensive Dental Exam & Cleaning ($120)",
        summary:
          "Caller verified Delta Dental PPO insurance coverage and booked a 60-minute cleaning with Hygienist Amy.",
        transcript: [
          {
            role: "agent",
            text: "Apex Family Dental, this is Maya. How may I help you?",
          },
          {
            role: "user",
            text: "Do you take Delta Dental PPO, and can I book a cleaning?",
          },
          {
            role: "agent",
            text: "Yes, we are in-network with Delta Dental PPO! I've scheduled your Comprehensive Exam & Cleaning with Hygienist Amy for Thursday at 10:00 AM.",
          },
        ],
      },
    ],
    appointments: [
      {
        id: "apt_c1",
        clientName: "Robert Martinez",
        clientPhone: "+1 (555) 489-2231",
        serviceName: "Emergency Toothache Consultation",
        staffMember: "Dr. Harrison",
        dateTime: "Tomorrow, 8:30 AM",
        durationMinutes: 30,
        price: 95,
        status: "confirmed",
        bookedVia: "AI Voice Receptionist",
      },
      {
        id: "apt_c2",
        clientName: "Claire Redfield",
        clientPhone: "+1 (555) 773-1992",
        serviceName: "Comprehensive Dental Exam & Cleaning",
        staffMember: "Hygienist Amy",
        dateTime: "Thursday, 10:00 AM",
        durationMinutes: 60,
        price: 120,
        status: "confirmed",
        bookedVia: "AI Voice Receptionist",
      },
    ],
  },
};
