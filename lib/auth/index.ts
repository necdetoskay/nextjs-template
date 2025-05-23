import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, checkDatabaseConnection } from "@/db";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import { User } from "next-auth";
import { AuthOptions } from "next-auth";
// Import the types
import "./types";

// Define the configuration object
const authConfig: AuthOptions = {
  // Configure your authentication providers
  providers: [
    CredentialsProvider({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      // The credentials is used to generate a suitable form on the sign in page.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Check database connection first
          const isConnected = await checkDatabaseConnection();
          if (!isConnected) {
            console.error("Database connection failed during authentication");
            throw new Error("Database connection error");
          }

          // Find the user by email
          const [user] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.email, credentials.email))
            .limit(1);

          // If user not found, return null
          if (!user || !user.password) {
            return null;
          }

          // Check if the password matches
          const passwordMatch = await bcrypt.compare(credentials.password, user.password);

          if (!passwordMatch) {
            return null;
          }

          // Return the user without the password
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
          };
        } catch (error) {
          console.error("Error in authorize:", error);
          // Return null on error to prevent login
          return null;
        }
      }
    })
  ],
  adapter: DrizzleAdapter(db),
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  callbacks: {
    // Include user.id and user.role in session
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    // Include user.role in the JWT token
    async jwt({ token, user }) {
      if (user) {
        // Add role to token from user object
        token.role = (user as any).role;
      }
      return token;
    }
  },
  logger: {
    error(code: string, metadata: any) {
      console.error(`NextAuth error [${code}]:`, metadata);
    }
  }
};

// Export the handlers, auth, signIn, and signOut from NextAuth
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig); 