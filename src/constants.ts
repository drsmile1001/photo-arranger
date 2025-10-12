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

export const jpgExtensions = [".jpg", ".jpeg"] as const;

export const photoExtensions = [
  ...jpgExtensions,
  ".heic",
  ".heif",
  ...rawExtensions,
] as const;
