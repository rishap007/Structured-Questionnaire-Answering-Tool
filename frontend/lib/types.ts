export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Questionnaire = {
  id: number;
  name: string;
  source_filename: string;
  created_at: string;
};

export type ReferenceDocument = {
  id: number;
  name: string;
  source_filename: string;
  created_at: string;
};

export type AnswerRow = {
  generated_answer_id: number;
  question_id: number;
  question_uid: string;
  position: number;
  question_text: string;
  generated_answer_text: string;
  generated_citations: string;
  edited_answer_text: string | null;
  edited_citations: string | null;
  evidence_snippets: EvidenceSnippet[];
  confidence_score: number;
  confidence_level: "High" | "Medium" | "Low" | string;
  avg_similarity_score: number;
};

export type EvidenceSnippet = {
  citation: string;
  snippet_text: string;
  similarity: number;
};

export type RunSummary = {
  id: number;
  run_number: number;
  created_at: string;
};

export type QuestionnaireResults = {
  questionnaire: Questionnaire;
  run: RunSummary | null;
  summary: {
    total_questions: number;
    answered_with_citations: number;
    not_found_count: number;
  };
  answers: AnswerRow[];
};

export type CompareAnswerRow = {
  question_id: number;
  question_uid: string;
  position: number;
  question_text: string;
  old_answer_text: string;
  new_answer_text: string;
  old_confidence_score: number;
  new_confidence_score: number;
  changed: boolean;
};

export type RunComparison = {
  questionnaire: Questionnaire;
  old_run: RunSummary;
  new_run: RunSummary;
  total_questions: number;
  changed_answers: number;
  items: CompareAnswerRow[];
};
