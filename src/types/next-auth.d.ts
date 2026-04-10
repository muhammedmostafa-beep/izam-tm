import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      permissions: Record<string, boolean>;
      themePref: string;
      viewModePref: string;
      title: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    permissions?: Record<string, boolean>;
    themePref?: string;
    viewModePref?: string;
    avatarUrl?: string;
    title?: string;
  }
}
