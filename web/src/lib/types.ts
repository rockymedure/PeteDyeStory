export interface Database {
  public: {
    Tables: {
      acts: {
        Row: Act;
        Insert: Omit<Act, 'id' | 'created_at'>;
        Update: Partial<Omit<Act, 'id'>>;
      };
      story_elements: {
        Row: StoryElement;
        Insert: Omit<StoryElement, 'id' | 'created_at'>;
        Update: Partial<Omit<StoryElement, 'id'>>;
      };
      videos: {
        Row: Video;
        Insert: Omit<Video, 'id' | 'created_at'>;
        Update: Partial<Omit<Video, 'id'>>;
      };
      clips: {
        Row: Clip;
        Insert: Omit<Clip, 'id' | 'created_at'>;
        Update: Partial<Omit<Clip, 'id'>>;
      };
      clip_story_links: {
        Row: ClipStoryLink;
        Insert: ClipStoryLink;
        Update: Partial<ClipStoryLink>;
      };
    };
  };
}

export interface Act {
  id: string;
  act_number: number;
  title: string;
  description: string | null;
  duration_target: string | null;
  tone: string | null;
  created_at: string;
}

export interface StoryElement {
  id: string;
  act_id: string | null;
  element_type: 'journey_point' | 'key_moment' | 'theme' | 'character';
  title: string;
  description: string | null;
  why_it_matters: string | null;
  quote: string | null;
  sort_order: number;
  created_at: string;
}

export interface Video {
  id: string;
  title: string;
  filename: string;
  duration_seconds: number | null;
  summary: string | null;
  characters: string[] | null;
  chapters: Chapter[] | null;
  highlights: string[] | null;
  transcript_word_count: number;
  processing_status: 'pending' | 'partial' | 'full' | 'failed';
  created_at: string;
}

export interface Chapter {
  title: string;
  start_time: string;
  description?: string;
}

export interface Clip {
  id: string;
  video_id: string;
  title: string | null;
  filename: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  start_time: string | null;
  duration_seconds: number | null;
  description: string | null;
  priority: number;
  sort_order: number;
  created_at: string;
}

export interface ClipStoryLink {
  clip_id: string;
  story_element_id: string;
  relevance_notes: string | null;
  is_primary: boolean;
}

// Extended types with relations
export interface ActWithElements extends Act {
  story_elements: StoryElement[];
}

export interface StoryElementWithClips extends StoryElement {
  clips: Clip[];
}

export interface ClipWithVideo extends Clip {
  video: Video;
}
