import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
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

type GoogleTokenInfo = {
  sub: string;
  email: string;
  email_verified: string;
  name?: string;
  picture?: string;
  aud: string;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
    Credentials({
      id: "google-onetap",
      name: "Google One-Tap",
      credentials: {
        idToken: { type: "text" },
      },
      async authorize(creds) {
        const idToken = (creds?.idToken as string | undefined)?.trim();
        if (!idToken) return null;

        const r = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (!r.ok) return null;
        const p = (await r.json()) as GoogleTokenInfo;

        if (p.aud !== process.env.GOOGLE_ID) return null;
        if (p.email_verified !== "true") return null;
        if (!p.sub || !p.email) return null;

        const { env } = getCloudflareContext();
        await env.DB.prepare(
          `INSERT INTO users (id, email, full_name, avatar_url, period_ends_at)
           VALUES (?1, ?2, ?3, ?4, datetime('now', 'start of day', '+1 day'))
           ON CONFLICT(id) DO UPDATE SET
             email      = excluded.email,
             full_name  = excluded.full_name,
             avatar_url = excluded.avatar_url`
        )
          .bind(p.sub, p.email, p.name ?? null, p.picture ?? null)
          .run();

        return {
          id: p.sub,
          email: p.email,
          name: p.name ?? null,
          image: p.picture ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google-onetap") return true;

      if (account?.provider !== "google" || !profile?.sub || !profile.email) {
        return false;
      }

      const { env } = getCloudflareContext();
      await env.DB.prepare(
        `INSERT INTO users (id, email, full_name, avatar_url, period_ends_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now', 'start of day', '+1 day'))
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
    async jwt({ token, profile, user }) {
      if (profile?.sub) token.sub = profile.sub;
      if (user?.id) token.sub = user.id;
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
