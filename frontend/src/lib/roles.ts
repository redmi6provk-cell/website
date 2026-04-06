import { User } from "@/types";

export type AppRole = User["role"];

export function isStaffRole(role?: AppRole | null) {
  return role === "ACCOUNTANT" || role === "ADMIN" || role === "SUPERADMIN";
}

export function canAccessAdmin(role?: AppRole | null) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function canAccessERP(role?: AppRole | null) {
  return role === "ACCOUNTANT" || role === "ADMIN" || role === "SUPERADMIN";
}
