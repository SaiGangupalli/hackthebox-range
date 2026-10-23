import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

// Credentials + JWT sessions. Handles are stored in Neon (hhb_user); no OAuth
// provider needed, so nothing external has to be provisioned to run this.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { handle: {}, password: {} },
      authorize: async (creds) => {
        const handle = String(creds?.handle ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!handle || !password) return null;
        const user = await prisma.user.findUnique({ where: { handle } });
        if (!user || !verifyPassword(password, user.password)) return null;
        return { id: user.id, name: user.handle };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = (user as { id?: string }).id;
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
