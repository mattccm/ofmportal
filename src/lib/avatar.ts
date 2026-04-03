/**
 * Avatar utilities for generating initials, gradients, and URLs
 */

// Define a set of beautiful gradient pairs for avatars
const AVATAR_GRADIENTS = [
  { from: "#667eea", to: "#764ba2" }, // Indigo to Purple
  { from: "#f093fb", to: "#f5576c" }, // Pink to Rose
  { from: "#4facfe", to: "#00f2fe" }, // Sky to Cyan
  { from: "#43e97b", to: "#38f9d7" }, // Emerald to Teal
  { from: "#fa709a", to: "#fee140" }, // Rose to Amber
  { from: "#a8edea", to: "#fed6e3" }, // Mint to Blush
  { from: "#5ee7df", to: "#b490ca" }, // Teal to Lavender
  { from: "#d299c2", to: "#fef9d7" }, // Mauve to Cream
  { from: "#89f7fe", to: "#66a6ff" }, // Aqua to Blue
  { from: "#cd9cf2", to: "#f6f3ff" }, // Lilac to White
  { from: "#fddb92", to: "#d1fdff" }, // Gold to Ice
  { from: "#a1c4fd", to: "#c2e9fb" }, // Periwinkle to Sky
  { from: "#fbc2eb", to: "#a6c1ee" }, // Pink to Lavender Blue
  { from: "#84fab0", to: "#8fd3f4" }, // Mint to Azure
  { from: "#ff9a9e", to: "#fecfef" }, // Coral to Blush
  { from: "#ffecd2", to: "#fcb69f" }, // Cream to Peach
];

/**
 * Generate a consistent hash from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate initials from a name
 * - "John Doe" -> "JD"
 * - "John" -> "JO"
 * - "j" -> "J"
 * - "" -> "?"
 */
export function generateInitials(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) {
    return "?";
  }

  const trimmedName = name.trim();
  const words = trimmedName.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    // Single word - take first two characters
    const word = words[0];
    if (word.length === 1) {
      return word.toUpperCase();
    }
    return word.substring(0, 2).toUpperCase();
  }

  // Multiple words - take first letter of first and last word
  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Get a consistent gradient based on a name hash
 * Returns both color values for CSS gradient usage
 */
export function getAvatarGradient(
  name: string | null | undefined
): { from: string; to: string; style: string } {
  const safeName = name || "default";
  const hash = hashString(safeName.toLowerCase());
  const index = hash % AVATAR_GRADIENTS.length;
  const gradient = AVATAR_GRADIENTS[index];

  return {
    from: gradient.from,
    to: gradient.to,
    style: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
  };
}

/**
 * Get CSS class for avatar gradient based on name
 * This returns inline style object for React components
 */
export function getAvatarGradientStyle(
  name: string | null | undefined
): React.CSSProperties {
  const gradient = getAvatarGradient(name);
  return {
    background: gradient.style,
  };
}

/**
 * User type for avatar utilities
 */
export interface AvatarUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatar?: string | null;
}

/**
 * Get avatar URL from user object
 * Prioritizes avatar (user-uploaded) over image (OAuth/legacy)
 */
export function getAvatarUrl(user: AvatarUser | null | undefined): string | null {
  if (!user) return null;
  return user.avatar || user.image || null;
}

/**
 * Check if a user has an avatar set
 */
export function hasAvatar(user: AvatarUser | null | undefined): boolean {
  return !!getAvatarUrl(user);
}

/**
 * Get display name for avatar
 * Falls back through name -> email username -> "User"
 */
export function getDisplayName(user: AvatarUser | null | undefined): string {
  if (!user) return "User";
  if (user.name) return user.name;
  if (user.email) {
    const emailName = user.email.split("@")[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  return "User";
}

/**
 * Generate full avatar data for a user
 * Useful for components that need all avatar information
 */
export function getAvatarData(user: AvatarUser | null | undefined): {
  url: string | null;
  initials: string;
  gradient: { from: string; to: string; style: string };
  displayName: string;
  hasImage: boolean;
} {
  const displayName = getDisplayName(user);
  return {
    url: getAvatarUrl(user),
    initials: generateInitials(displayName),
    gradient: getAvatarGradient(displayName),
    displayName,
    hasImage: hasAvatar(user),
  };
}

/**
 * Compress an image file for avatar upload
 * Returns a base64 string of the compressed image
 */
export async function compressAvatarImage(
  file: File,
  maxSize: number = 256,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Calculate dimensions to maintain aspect ratio
        let { width, height } = img;
        const aspectRatio = width / height;

        if (aspectRatio > 1) {
          // Landscape - fit height
          height = maxSize;
          width = height * aspectRatio;
        } else {
          // Portrait or square - fit width
          width = maxSize;
          height = width / aspectRatio;
        }

        // Set canvas size to be square
        canvas.width = maxSize;
        canvas.height = maxSize;

        // Calculate centering offset for circular crop effect
        const offsetX = (maxSize - width) / 2;
        const offsetY = (maxSize - height) / 2;

        // Fill with transparent background
        ctx.clearRect(0, 0, maxSize, maxSize);

        // Draw the image centered
        ctx.drawImage(img, offsetX, offsetY, width, height);

        // Convert to base64
        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate avatar file
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB max before compression
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Please upload a JPEG, PNG, GIF, or WebP image",
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "Image must be less than 10MB",
    };
  }

  return { valid: true };
}
