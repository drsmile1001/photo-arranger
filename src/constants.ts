export const rawExtensions = [
  ".nef",
  ".arw",
  ".cr2",
  ".cr3",
  ".dng",
  ".orf",
  ".rw2",
  ".raf",
] as const;

export const photoExtensions = [
  ".jpg",
  ".jpeg",
  ".heic",
  ".heif",
  ...rawExtensions,
] as const;
