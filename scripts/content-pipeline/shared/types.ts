export interface RawContentItem {
  type: 'word' | 'phrase' | 'sentence_pair' | 'grammar_rule';
  language: string;
  cefrLevel?: string;
  nativeText: string;
  targetText: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  tags: string[];
  sourceDatasetId: string;
  sourceItemId?: string;
}

export interface PipelineConfig {
  source: string;
  language: string;
  limit?: number;
  fillGaps?: boolean;
  dryRun?: boolean;
}

export interface ImportResult {
  cardsInserted: number;
  cardsUpdated: number;
  exercisesGenerated: number;
  errors: string[];
}
