export const extractMentions = (text: string): string[] => {
  const regex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.map(m => m.replace("@", "").toLowerCase());
};

export const extractHashtags = (text: string): string[] => {
  const regex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.map(tag => tag.replace("#", "").toLowerCase());
};
