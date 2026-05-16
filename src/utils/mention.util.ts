export const extractMentions = (text: string): string[] => {
  const value = String(text || "");

  const regex = /@([^\s@]+)/g;

  const matches = value.match(regex);

  if (!matches) return [];

  return matches
    .map((m) =>
      m
        .replace(/^@+/, "")
        .trim()
    )
    .filter(Boolean);
};
export const extractHashtags = (text: string): string[] => {
  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.map(tag => tag.replace("#", "").toLowerCase());
};
