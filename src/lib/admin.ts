// Organizers are named by handle in ADMIN_HANDLES (comma-separated), so no
// database role is needed and access can be changed without a migration.
import { auth } from "@/auth";

export function adminHandles(): Set<string> {
  return new Set((process.env.ADMIN_HANDLES ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
}

export const isAdminHandle = (handle: string | null | undefined) => !!handle && adminHandles().has(handle.toLowerCase());

// The signed-in organizer, or null for everyone else.
export async function currentAdmin(): Promise<{ id: string; handle: string } | null> {
  const user = (await auth())?.user as { id?: string; name?: string | null } | undefined;
  if (!user?.id || !isAdminHandle(user.name)) return null;
  return { id: user.id, handle: user.name! };
}
