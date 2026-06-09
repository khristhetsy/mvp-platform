/** Toggle admin workspace modules between full UI and a coming-soon placeholder. */
export const ADMIN_MODULE_COMING_SOON = {
  spvs: true,
  pageBuilderLab: true,
  automation: true,
  integrations: true,
  betaOperations: true,
  learning: false,
} as const;

export type AdminModuleFlagKey = keyof typeof ADMIN_MODULE_COMING_SOON;

export function isAdminModuleComingSoon(module: AdminModuleFlagKey): boolean {
  return ADMIN_MODULE_COMING_SOON[module];
}
