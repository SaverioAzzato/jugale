export const HELP_TOPIC_IDS = ["start", "play", "manage", "chatbots", "files", "json"] as const;
export type HelpTopicId = (typeof HELP_TOPIC_IDS)[number];

export interface HelpDetail {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface HelpMedia {
  src: string;
  alt: string;
  caption: string;
}

export interface HelpGalleryItem {
  title: string;
  body: string;
  media: HelpMedia;
}

export interface HelpTopicLink {
  topicId: HelpTopicId;
  label: string;
}

export interface HelpFileItem {
  name: string;
  description: string;
}

export interface HelpSection {
  title: string;
  intro?: string;
  steps?: string[];
  bullets?: string[];
  details?: HelpDetail[];
  media?: HelpMedia;
  gallery?: HelpGalleryItem[];
  flow?: string[];
  links?: HelpTopicLink[];
  files?: HelpFileItem[];
}

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  summary: string;
  sections: HelpSection[];
}

export interface HelpCatalog {
  heroTitle: string;
  heroBody: string;
  topics: HelpTopic[];
}

export function assertHelpCatalog(catalog: HelpCatalog): HelpCatalog {
  const ids = catalog.topics.map((topic) => topic.id);
  if (ids.length !== HELP_TOPIC_IDS.length || HELP_TOPIC_IDS.some((id, index) => ids[index] !== id)) {
    throw new Error("Help topics must match the canonical order");
  }
  return catalog;
}
