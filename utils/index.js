export const truncateVersion = (version) => {
  if (!version) return version;
  return version.length > 20 ? version.substring(0, 20) + '...' : version;
};
