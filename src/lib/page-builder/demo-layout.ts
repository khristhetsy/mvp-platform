import { createBlock } from "@/lib/page-builder/blocks";
import type { PageBuilderSlug, PageLayoutDocument } from "@/lib/page-builder/types";

export function buildDemoLayout(pageSlug: PageBuilderSlug): PageLayoutDocument {
  const hero = createBlock("hero");
  const trust = createBlock("trust_badges");
  const features = createBlock("feature_grid");
  const metrics = createBlock("metrics_row");
  const cta = createBlock("cta_band");

  if (pageSlug === "founders") {
    hero.props.headline = "Become capital-ready before entering the market.";
    hero.props.subheadline =
      "CapitalOS helps founders organize diligence, validate traction, and prepare for investor review.";
    hero.props.primaryCtaLabel = "Submit your company";
    hero.props.secondaryCtaLabel = "";
  }

  if (pageSlug === "investors") {
    hero.props.headline = "Review curated private opportunities with diligence context.";
    hero.props.primaryCtaLabel = "Explore opportunities";
    hero.props.primaryCtaHref = "/deals";
    hero.props.secondaryCtaLabel = "Investor login";
    hero.props.secondaryCtaHref = "/login";
  }

  if (pageSlug === "deals") {
    hero.props.headline = "Reviewed private opportunities with diligence context.";
    hero.props.eyebrow = "Investor marketplace";
    hero.props.primaryCtaLabel = "";
    hero.props.secondaryCtaLabel = "";
  }

  if (pageSlug === "login") {
    hero.props.headline = "Sign in to continue your capital readiness workflow.";
    hero.props.eyebrow = "Platform access";
    hero.props.primaryCtaLabel = "Sign in";
    hero.props.primaryCtaHref = "/auth/sign-in";
    hero.props.secondaryCtaLabel = "Create account";
    hero.props.secondaryCtaHref = "/auth/sign-up";
  }

  return {
    version: 1,
    pageSlug,
    blocks: [hero, trust, features, metrics, cta],
  };
}

export function emptyLayout(pageSlug: PageBuilderSlug): PageLayoutDocument {
  return { version: 1, pageSlug, blocks: [] };
}
