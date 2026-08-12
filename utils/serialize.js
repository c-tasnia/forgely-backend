export const toSafeUser = (user) => {
  if (!user) return null;
  const { id, name, email, role, profilePicture, skills, bio, githubUsername, githubConnected, createdAt } = user;
  return { id, name, email, role, profilePicture, skills, bio, githubUsername, githubConnected, createdAt };
};

export const toAdminUser = (user) => {
  if (!user) return null;
  const { id, name, email, role, banned, bannedReason, createdAt } = user;
  return { id, name, email, role, banned, bannedReason, createdAt };
};

// Strips password off any nested user objects returned by Prisma includes (owner, members.user, etc.)
export const stripPasswords = (obj) => JSON.parse(JSON.stringify(obj, (key, value) => (key === "password" ? undefined : value)));
