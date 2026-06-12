import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

// Build providers array dynamically based on available credentials
const providers = [];

// Always include credentials provider
providers.push(
    CredentialsProvider({
        name: "credentials",
        credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) {
                return null;
            }

            const user = await prisma.user.findUnique({
                where: { email: credentials.email as string },
            });

            if (!user || !user.passwordHash) {
                return null;
            }

            const passwordMatch = await bcrypt.compare(
                credentials.password as string,
                user.passwordHash
            );

            if (!passwordMatch) {
                return null;
            }

            return {
                id: user.id,
                email: user.email,
                name: user.username || user.name,
                image: user.image,
            };
        },
    })
);

// Add GitHub provider if credentials are configured
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
        GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            // Allows logging in with GitHub even if an account with the same email
            // was created via credentials. This merges into one user instead of
            // throwing OAuthAccountNotLinked.
            allowDangerousEmailAccountLinking: true,
        })
    );
}

// Add Google provider if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        })
    );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    ...authConfig,
    providers,
    trustHost: true,
    debug: process.env.NODE_ENV !== 'production',
});
