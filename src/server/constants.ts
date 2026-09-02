export const USER_ROLES = ["customer", "staff", "manager"] as const;

export type UserRole = (typeof USER_ROLES)[number];

// Guvenlik (MP-0.2): Sabit yonetici e-postalari koddan cikarildi. Yonetici
// e-postalari yalnizca DEFAULT_MANAGER_EMAILS / BOOTSTRAP_ADMIN_EMAIL env
// degiskenleriyle tanimlanir (bkz. services/role.ts).

