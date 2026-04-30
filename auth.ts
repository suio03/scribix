import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getCloudflareContext } from "@opennextjs/cloudflare";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile?.sub || !profile.email) {
        return false;
      }

      const { env } = getCloudflareContext();
      await env.DB.prepare(
        `INSERT INTO users (id, email, full_name, avatar_url, period_ends_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now', '+30 days'))
         ON CONFLICT(id) DO UPDATE SET
           email      = excluded.email,
           full_name  = excluded.full_name,
           avatar_url = excluded.avatar_url`
      )
        .bind(
          profile.sub,
          profile.email,
          (profile.name as string | undefined) ?? null,
          (profile.picture as string | undefined) ?? null
        )
        .run();

      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
  },
});
