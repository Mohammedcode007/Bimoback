// validators.ts
export const validateUsername = (username: string) => {
  if (!username || username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
};

export const validatePassword = (password: string) => {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
};
