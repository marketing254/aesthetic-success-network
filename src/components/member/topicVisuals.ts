import type { SvgIconComponent } from "@mui/icons-material";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import PhoneInTalkOutlinedIcon from "@mui/icons-material/PhoneInTalkOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import LoyaltyOutlinedIcon from "@mui/icons-material/LoyaltyOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";

/**
 * Per-topic visual identity: icon + gradient.
 *
 * Each topic gets a distinct but on-brand treatment so the resource library
 * doesn't feel like a wall of generic cards. The gradients are tuned to feel
 * premium (deep base color with a subtle accent), and the icon is rendered
 * at low opacity as a decorative background element on the card.
 *
 * Slugs follow the ASN kit vocabulary (pricing & margins, consult
 * conversion, team & injector hiring, aesthetic marketing, patient
 * retention & memberships, compliance & medical direction, finance & CFO).
 * Add new topics here as the catalog grows. Unknown slugs fall back to a
 * neutral navy treatment with a lightbulb icon.
 */
export type TopicVisual = {
  icon: SvgIconComponent;
  gradient: string;          // CSS gradient for the card thumbnail
  accent: string;            // Solid hex for badges / outlines
  iconColor: string;         // Color the icon should render in
};

const VISUALS: Record<string, TopicVisual> = {
  "kpis": {
    icon: BarChartOutlinedIcon,
    gradient: "linear-gradient(135deg, #0A1A2F 0%, #1B4258 60%, #2D6F8E 100%)",
    accent: "#5BA0C4",
    iconColor: "rgba(91,160,196,0.85)",
  },
  "kpis-med-spa": {
    icon: BarChartOutlinedIcon,
    gradient: "linear-gradient(135deg, #0A1A2F 0%, #1F3850 60%, #2D6F8E 100%)",
    accent: "#5BA0C4",
    iconColor: "rgba(91,160,196,0.85)",
  },
  "injectables-pricing": {
    icon: PaidOutlinedIcon,
    gradient: "linear-gradient(135deg, #1A1305 0%, #5C4115 60%, #A07823 100%)",
    accent: "#F0C16E",
    iconColor: "rgba(240,193,110,0.9)",
  },
  "pricing-margins": {
    icon: PaidOutlinedIcon,
    gradient: "linear-gradient(135deg, #1A1305 0%, #5C4115 60%, #A07823 100%)",
    accent: "#F0C16E",
    iconColor: "rgba(240,193,110,0.9)",
  },
  "consult-conversion": {
    icon: HandshakeOutlinedIcon,
    gradient: "linear-gradient(135deg, #0A1A2F 0%, #1F4068 60%, #2C5E96 100%)",
    accent: "#5081B5",
    iconColor: "rgba(80,129,181,0.85)",
  },
  "consult-scripts": {
    icon: HandshakeOutlinedIcon,
    gradient: "linear-gradient(135deg, #0A1A2F 0%, #1F4068 60%, #2C5E96 100%)",
    accent: "#5081B5",
    iconColor: "rgba(80,129,181,0.85)",
  },
  "scheduling-treatment-rooms": {
    icon: CalendarMonthOutlinedIcon,
    gradient: "linear-gradient(135deg, #0F2A24 0%, #1F5C40 60%, #3A8C68 100%)",
    accent: "#5BAE85",
    iconColor: "rgba(91,174,133,0.85)",
  },
  "marketing-mistakes": {
    icon: CampaignOutlinedIcon,
    gradient: "linear-gradient(135deg, #2A1010 0%, #8C1D1D 60%, #C84F4F 100%)",
    accent: "#D27676",
    iconColor: "rgba(210,118,118,0.85)",
  },
  "aesthetic-marketing": {
    icon: CampaignOutlinedIcon,
    gradient: "linear-gradient(135deg, #2A1010 0%, #8C1D1D 60%, #C84F4F 100%)",
    accent: "#D27676",
    iconColor: "rgba(210,118,118,0.85)",
  },
  "mindset-shift": {
    icon: PsychologyOutlinedIcon,
    gradient: "linear-gradient(135deg, #1B0F2A 0%, #3D2168 60%, #6C4FB5 100%)",
    accent: "#9E80D6",
    iconColor: "rgba(158,128,214,0.85)",
  },
  "team-huddle": {
    icon: GroupsOutlinedIcon,
    gradient: "linear-gradient(135deg, #1F1F0A 0%, #5C5219 60%, #A07823 100%)",
    accent: "#D9A84B",
    iconColor: "rgba(217,168,75,0.9)",
  },
  "injector-hiring": {
    icon: GroupsOutlinedIcon,
    gradient: "linear-gradient(135deg, #1F1F0A 0%, #5C5219 60%, #A07823 100%)",
    accent: "#D9A84B",
    iconColor: "rgba(217,168,75,0.9)",
  },
  "phone-skills": {
    icon: PhoneInTalkOutlinedIcon,
    gradient: "linear-gradient(135deg, #0F1A2A 0%, #1F3470 60%, #4257A8 100%)",
    accent: "#7387C7",
    iconColor: "rgba(115,135,199,0.85)",
  },
  "reviews-trust": {
    icon: StarOutlineOutlinedIcon,
    gradient: "linear-gradient(135deg, #2A1F05 0%, #5C4115 60%, #C19142 100%)",
    accent: "#E5B65E",
    iconColor: "rgba(229,182,94,0.9)",
  },
  "patient-retention": {
    icon: LoyaltyOutlinedIcon,
    gradient: "linear-gradient(135deg, #2A0F1A 0%, #6E3346 60%, #A8557A 100%)",
    accent: "#D48CAE",
    iconColor: "rgba(212,140,174,0.85)",
  },
  "memberships": {
    icon: LoyaltyOutlinedIcon,
    gradient: "linear-gradient(135deg, #2A0F1A 0%, #6E3346 60%, #A8557A 100%)",
    accent: "#D48CAE",
    iconColor: "rgba(212,140,174,0.85)",
  },
  "seo-intro": {
    icon: SearchOutlinedIcon,
    gradient: "linear-gradient(135deg, #051F2A 0%, #155C68 60%, #3795A0 100%)",
    accent: "#5BB5C0",
    iconColor: "rgba(91,181,192,0.85)",
  },
  "seo-google-rankings": {
    icon: TrendingUpOutlinedIcon,
    gradient: "linear-gradient(135deg, #051F2A 0%, #105C70 60%, #3795A0 100%)",
    accent: "#5BB5C0",
    iconColor: "rgba(91,181,192,0.85)",
  },
  "compliance-medical-direction": {
    icon: VerifiedUserOutlinedIcon,
    gradient: "linear-gradient(135deg, #0F2A24 0%, #1F5238 60%, #2C7A52 100%)",
    accent: "#5BAE85",
    iconColor: "rgba(91,174,133,0.85)",
  },
  "finance-cfo": {
    icon: AccountBalanceOutlinedIcon,
    gradient: "linear-gradient(135deg, #0A1A2F 0%, #1F3850 60%, #355276 100%)",
    accent: "#A07823",
    iconColor: "rgba(217,168,75,0.85)",
  },
};

const FALLBACK: TopicVisual = {
  icon: LightbulbOutlinedIcon,
  gradient: "linear-gradient(135deg, #0A1A2F 0%, #1F3850 60%, #355276 100%)",
  accent: "#A07823",
  iconColor: "rgba(217,168,75,0.85)",
};

export function visualForTopic(slug: string): TopicVisual {
  return VISUALS[slug] ?? FALLBACK;
}

/**
 * Topic "category" mapped from the slug — used in the filter chip row.
 * Multiple topic slugs can share the same category so the filter is concise.
 */
export type TopicCategory =
  | "all"
  | "kpis"
  | "operations"
  | "marketing"
  | "growth"
  | "mindset";

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  all: "All",
  kpis: "Numbers & KPIs",
  operations: "Operations & compliance",
  marketing: "Marketing & growth",
  growth: "Pricing & conversion",
  mindset: "Mindset",
};

export function categoryForSlug(slug: string): TopicCategory {
  if (slug.startsWith("kpi") || slug.startsWith("finance")) return "kpis";
  if (
    slug.startsWith("scheduling") ||
    slug.startsWith("team") ||
    slug.startsWith("injector") ||
    slug.startsWith("phone-skills") ||
    slug.startsWith("compliance")
  )
    return "operations";
  if (
    slug.startsWith("marketing") ||
    slug.startsWith("aesthetic-marketing") ||
    slug.startsWith("seo") ||
    slug.startsWith("reviews")
  )
    return "marketing";
  if (
    slug.startsWith("consult") ||
    slug.startsWith("pricing") ||
    slug.startsWith("injectables") ||
    slug.startsWith("patient-retention") ||
    slug.startsWith("memberships")
  )
    return "growth";
  if (slug.startsWith("mindset")) return "mindset";
  return "all";
}
