/** Toggle admin workspace modules between full UI and a coming-soon placeholder. */
export const ADMIN_MODULE_COMING_SOON = {
  spvs: false,
  pageBuilderLab: true,
  automation: false,
  integrations: false,
  betaOperations: false,
  learning: false,
} as const;

export type AdminModuleFlagKey = keyof typeof ADMIN_MODULE_COMING_SOON;

export function isAdminModuleComingSoon(module: AdminModuleFlagKey): boolean {
  return ADMIN_MODULE_COMING_SOON[module];
}
