import bcrypt from "bcryptjs";

// bcryptjs (pure JavaScript) is used instead of bcrypt (native) on purpose:
// native bcrypt often fails to compile on Windows, and this project is
// developed on Windows. Cost factor 10 is the standard default.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
