/** Original ReaCut assets. Files are generated locally by scripts/generate-assets.ts. */
export type BuiltinAssetCategory = "stickers" | "backgrounds" | "titles" | "sounds";
export interface BuiltinAsset {
  id: string;
  name: string;
  category: BuiltinAssetCategory;
  kind: "image" | "audio";
  fileName: string;
  width: number;
  height: number;
  duration: number;
  tags: string[];
  transparent: boolean;
}
const image = (id: string, name: string, category: Exclude<BuiltinAssetCategory, "sounds">, tags: string[]): BuiltinAsset => ({
  id, name, category, kind: "image", fileName: `${id}.png`,
  width: category === "stickers" ? 512 : 1920,
  height: category === "stickers" ? 512 : 1080,
  duration: 5, tags, transparent: category !== "backgrounds",
});
const sound = (id: string, name: string, duration: number, tags: string[]): BuiltinAsset => ({
  id, name, category: "sounds", kind: "audio", fileName: `${id}.wav`,
  width: 0, height: 0, duration, tags, transparent: false,
});
export const BUILTIN_ASSETS: readonly BuiltinAsset[] = [
  image("sparkle", "Four-point sparkle", "stickers", ["star", "shine", "sparkle"]),
  image("burst", "Energy burst", "stickers", ["burst", "emphasis", "burst"]),
  image("heart", "Coral heart", "stickers", ["heart", "like", "heart"]),
  image("arrow-curved", "Hand-drawn curved arrow", "stickers", ["arrow", "direction", "arrow"]),
  image("arrow-left", "Rewind arrow", "stickers", ["rewind", "arrow", "reverse"]),
  image("play", "Mint play button", "stickers", ["play", "video", "play"]),
  image("check", "Check mark", "stickers", ["success", "complete", "check"]),
  image("pin", "Travel pin", "stickers", ["travel", "location", "pin"]),
  image("speech", "Speech bubble", "stickers", ["chat", "text", "speech"]),
  image("quote", "Quote marks", "stickers", ["interview", "quote", "quote"]),
  image("film", "Mini film strip", "stickers", ["movie", "film", "film"]),
  image("clap", "Movie clapperboard", "stickers", ["clapperboard", "movie", "clap"]),
  image("sun", "Little sunshine", "stickers", ["weather", "sunshine", "sun"]),
  image("rainbow", "Soft rainbow", "stickers", ["rainbow", "life", "rainbow"]),
  image("confetti", "Celebration confetti", "stickers", ["celebration", "holiday", "confetti"]),
  image("focus", "Viewfinder", "stickers", ["lens", "focus", "focus"]),
  image("bg-midnight", "Midnight gradient", "backgrounds", ["navy", "gradient", "dark"]),
  image("bg-sunrise", "Coral sunrise", "backgrounds", ["warm", "gradient", "warm"]),
  image("bg-mint", "Mint glow", "backgrounds", ["fresh", "green", "mint"]),
  image("bg-paper", "Warm paper texture", "backgrounds", ["paper", "minimal", "paper"]),
  image("bg-grid", "Dark coordinate grid", "backgrounds", ["tech", "grid", "grid"]),
  image("bg-orbit", "Blue-violet orbit", "backgrounds", ["tech", "orbit", "orbit"]),
  image("title-mint", "Mint lower third", "titles", ["people", "lower third", "interview"]),
  image("title-coral", "Coral caption bar", "titles", ["captions", "lower third", "title"]),
  image("title-glass", "Dark info card", "titles", ["info", "card", "title"]),
  image("title-frame", "Fine film frame", "titles", ["frame", "movie", "title"]),
  image("title-corner", "Corner tag and sidebar", "titles", ["corner tag", "section", "title"]),
  image("title-ribbon", "Highlight ribbon", "titles", ["highlight", "ribbon", "title"]),
  sound("sound-pop", "Light pop", 0.25, ["pop", "transition", "pop"]),
  sound("sound-click", "Soft click", 0.12, ["click", "interface", "click"]),
  sound("sound-chime", "Bright chime", 1.2, ["bell", "notification", "chime"]),
  sound("sound-rise", "Rising sweep", 0.65, ["rise", "transition", "rise"]),
  sound("sound-whoosh", "Airy whoosh", 0.8, ["whoosh", "transition", "whoosh"]),
  sound("sound-complete", "Three-note finish", 1.4, ["success", "complete", "complete"]),
  image("bolt", "Lightning accent", "stickers", ["lightning", "energy", "bolt"]),
  image("cloud", "Soft cloud", "stickers", ["weather", "sky", "cloud"]),
  image("moon", "Moonlit stars", "stickers", ["moon", "night", "moon"]),
  image("leaf", "Fresh green leaf", "stickers", ["plant", "nature", "leaf"]),
  image("flame", "Bright flame", "stickers", ["fire", "trending", "flame"]),
  image("camera", "Travel camera", "stickers", ["photography", "travel", "camera"]),
  image("headphones", "Everyday headphones", "stickers", ["music", "listen", "headphones"]),
  image("microphone", "Podcast microphone", "stickers", ["recording", "interview", "microphone"]),
  image("coffee", "Coffee break", "stickers", ["life", "drink", "coffee"]),
  image("paw", "Pet paw prints", "stickers", ["animal", "pet", "paw"]),
  image("medal", "Achievement medal", "stickers", ["reward", "achievement", "medal"]),
  image("clock", "Time reminder", "stickers", ["clock", "countdown", "clock"]),
  image("bg-aurora", "Aurora night", "backgrounds", ["aurora", "nightscape", "aurora"]),
  image("bg-ocean", "Ocean waves", "backgrounds", ["ocean", "blue", "ocean"]),
  image("bg-lavender", "Lavender glow", "backgrounds", ["purple", "dreamy", "lavender"]),
  image("bg-peach", "Peach geometry", "backgrounds", ["pink", "geometry", "peach"]),
  image("bg-sand", "Desert dunes", "backgrounds", ["desert", "nature", "sand"]),
  image("bg-dots", "Cream polka dots", "backgrounds", ["dots", "cute", "dots"]),
  image("bg-blueprint", "Technical blueprint", "backgrounds", ["blueprint", "tech", "blueprint"]),
  image("bg-comic", "Comic rays", "backgrounds", ["comic", "emphasis", "comic"]),
  image("title-pill", "Rounded name tag", "titles", ["people", "rounded", "pill"]),
  image("title-news", "Double news bar", "titles", ["updates", "news", "news"]),
  image("title-split", "Two-tone chapter card", "titles", ["chapter", "split screen", "split"]),
  image("title-subtitle", "Soft dark caption bar", "titles", ["captions", "gradient", "subtitle"]),
  image("title-tape", "Memo tape", "titles", ["journal", "tape", "tape"]),
  image("title-chapter", "Minimal chapter line", "titles", ["chapter", "minimal", "chapter"]),
  sound("sound-shutter", "Digital shutter", 0.22, ["photography", "shutter", "shutter"]),
  sound("sound-impact", "Low impact", 0.5, ["drum hit", "emphasis", "impact"]),
  sound("sound-twinkle", "Twinkle cue", 1.5, ["notification", "starlight", "twinkle"]),
  sound("sound-fall", "Falling sweep", 0.65, ["fall", "transition", "fall"]),
];
export const BUILTIN_CATEGORIES: { id: BuiltinAssetCategory; name: string }[] = [
  { id: "stickers", name: "Stickers" }, { id: "backgrounds", name: "Backgrounds" },
  { id: "titles", name: "Title plates" }, { id: "sounds", name: "Sound effects" },
];
export function findBuiltinAsset(id: string): BuiltinAsset | undefined {
  return BUILTIN_ASSETS.find((asset) => asset.id === id);
}
export function filterBuiltinAssets(category: BuiltinAssetCategory | "all", query: string): BuiltinAsset[] {
  const text = query.trim().toLocaleLowerCase();
  return BUILTIN_ASSETS.filter((asset) => (category === "all" || asset.category === category) &&
    `${asset.name} ${asset.tags.join(" ")}`.toLocaleLowerCase().includes(text));
}
export function builtinAssetUrl(asset: BuiltinAsset): string {
  return `${import.meta.env.BASE_URL}builtin-assets/${asset.fileName}`;
}
