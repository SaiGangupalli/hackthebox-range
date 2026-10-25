import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { RULES, check, take, reset, clientIp } from "@/lib/rateLimit";
import { isBanned } from "@/lib/settings";

// Sign-in errors the login page can explain (anything else reads as
// "invalid handle or password", so the form doesn't reveal which handles exist).
class RateLimited extends CredentialsSignin { code = "rate_limited"; }
class Suspended extends CredentialsSignin { code = "suspended"; }

// Credentials + JWT sessions. Handles are stored in Neon (hhb_user); no OAuth
// provider needed, so nothing external has to be provisioned to run this.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  // Browsers share localhost cookies across ports, so another Auth.js app on
  // e.g. :3002 would overwrite the default authjs.* cookies. Own names instead
  // (options are deep-merged, so httpOnly/sameSite/secure defaults still apply).
  cookies: {
    sessionToken: { name: "hhb.session-token" },
    csrfToken: { name: "hhb.csrf-token" },
    callbackUrl: { name: "hhb.callback-url" },
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { handle: {}, password: {} },
      // Failed attempts are limited per handle (stops password guessing on one
      // account) and all attempts per IP (stops spraying across accounts).
      authorize: async (creds, request) => {
        const handle = String(creds?.handle ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!handle || !password) return null;
        const failKey = `login-fail:${handle}`;
        if (!check(failKey, RULES.loginFailPerHandle).ok) throw new RateLimited();
        if (!take(`login-ip:${clientIp(request)}`, RULES.loginPerIp).ok) throw new RateLimited();
        const user = await prisma.user.findUnique({ where: { handle } });
        if (!user || !verifyPassword(password, user.password)) {
          take(failKey, RULES.loginFailPerHandle);
          return null;
        }
        if (await isBanned(user.id)) throw new Suspended();
        reset(failKey);
        return { id: user.id, name: user.handle };
      },
    }),
  ],
  callbacks: {
    // Returning null ends the session, so a ban signs the player out everywhere
    // on their next request (the ban list is cached for a few seconds).
    async jwt({ token, user }) {
      if (user) token.uid = (user as { id?: string }).id;
      if (token.uid && (await isBanned(token.uid as string))) return null;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
});
