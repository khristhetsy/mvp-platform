/**
 * Investor sign up (/investors/start). Investors are always free. Option lists
 * are the same ones investor onboarding uses, so answers carry over.
 */
import { INVESTOR_TYPE_OPTIONS, MONEY_BAND_OPTIONS } from "@/lib/profile/options";
import { EVENT_SECTORS } from "@/lib/icfo-events/sectors";

export const investorStart = {
  eyebrow: "For investors",
  title: "Create your investor account.",
  sub: "Free for investors, no subscription and no card. Set your mandate and monthly limit, and receive only rated companies that fit.",
  steps: [
    { n: "1", p: "Tell us your firm and mandate. Takes two minutes." },
    { n: "2", p: "Set a password and confirm your email." },
    { n: "3", p: "Set your monthly acceptance cap. You never receive more than you agreed to." },
    { n: "4", p: "Companies arrive with a readiness rating attached; accept or pass." },
  ],
  fields: {
    investorType: { label: "Investor type", options: INVESTOR_TYPE_OPTIONS },
    checkSize: { label: "Typical check size", options: MONEY_BAND_OPTIONS },
    sectors: { label: "Sectors (optional)", options: EVENT_SECTORS.map((s) => s.label) },
  },
  freeNote: "Free for investors.",
  freeNoteSub: "No subscription, no card, now or later.",
  submit: "Create free investor account",
  signinPrompt: "Already have an account?",
  founderPrompt: "Raising capital?",
  terms: "iCapOS is indication only. No transactions or funds are processed on the platform.",
} as const;
