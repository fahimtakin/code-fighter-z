import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { getRedis } from "@/lib/redis";

const SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";

export async function POST(req: NextRequest) {
  try {
    const { action, username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Missing required login parameters" }, { status: 400 });
    }

    const redis = getRedis();

    // === USER REGISTRATION MATRIX ===
    if (action === "signup") {
      const exists = await redis.exists(`user:${username}`);
      if (exists) {
        return NextResponse.json({ error: "Username already allocated" }, { status: 400 });
      }

      // Hash raw password strings securely using cryptographic salting
      const hashedPassword = await bcrypt.hash(password, 10);

      // Persist profile metadata to a clean Redis Hash mapping structure
      await redis.hset(`user:${username}`, {
        password: hashedPassword,
        wins: "0",
        losses: "0",
      });

      // Sign token envelope
      const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });

      const res = NextResponse.json({ success: true, token, username });
      
      // Issue matching secure HttpOnly cookie wrapper attributes
      res.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // Synchronized 7-day expiration boundary
      });

      return res;
    }

    // === USER LOGIN VALIDATION MATRIX ===
    if (action === "login") {
      const user = await redis.hgetall(`user:${username}`);

      if (!user || !user.password) {
        return NextResponse.json({ error: "Invalid username or password credentials" }, { status: 401 });
      }

      // Cryptographically verify match accuracy against salted database strings
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return NextResponse.json({ error: "Invalid username or password credentials" }, { status: 401 });
      }

      const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });

      const res = NextResponse.json({ success: true, token, username });
      res.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return res;
    }

    return NextResponse.json({ error: "Invalid router action command submitted" }, { status: 400 });
  } catch (error) {
    console.error("[Auth API] Execution pipeline drop exception:", error);
    return NextResponse.json({ error: "Internal service drop error" }, { status: 500 });
  }
}
