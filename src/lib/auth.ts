import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "izam.co")
  .split(",")
  .map((d) => d.trim().toLowerCase());

const providers: any[] = [];

// Google OAuth (only if real credentials exist)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "placeholder") {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

// Credentials provider (dev + production fallback)
providers.push(
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@izam.co" },
      name: { label: "Name", type: "text", placeholder: "Your Name" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string;
      const name = (credentials?.name as string) || email?.split("@")[0] || "User";
      if (!email) return null;

      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: { email, name, isActive: true },
      });

      return { id: user.id, email: user.email, name: user.name };
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const domain = user.email.split("@")[1]?.toLowerCase();
        if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
          return false;
        }
        // Upsert user in our DB
        const avatarUrl = (user as Record<string, unknown>).image as string | null;
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name || undefined,
            avatarUrl: avatarUrl || undefined,
          },
          create: {
            email: user.email,
            name: user.name || user.email.split("@")[0],
            avatarUrl: avatarUrl || null,
            isActive: true,
          },
        });
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (token.email) {
        // Fetch user from DB to keep role and name in sync
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          include: { role: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.name = dbUser.name;
          token.picture = dbUser.avatarUrl;
          token.role = dbUser.role?.name || "Viewer";
          token.permissions = dbUser.role?.permissions || {};
          token.themePref = dbUser.themePref;
          token.viewModePref = dbUser.viewModePref;
          token.title = dbUser.title;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
        session.user.role = token.role as string;
        session.user.permissions = token.permissions as Record<string, boolean>;
        session.user.themePref = token.themePref as string;
        session.user.viewModePref = token.viewModePref as string;
        session.user.title = token.title as string;
      }
      return session;
    },
  },
});
