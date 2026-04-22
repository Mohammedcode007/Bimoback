import bcrypt from "bcryptjs";

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, saltRounds);
}

export async function compareOtp(plainOtp: string, hashedOtp: string): Promise<boolean> {
  return bcrypt.compare(plainOtp, hashedOtp);
}