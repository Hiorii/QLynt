export {};

declare global {
  type QASettings = {
    acSynonyms: string[];
    detectFromJiraFieldsDom: boolean;
    detectFromDescription: boolean;
    detectFromGherkin: boolean;
  };

  type TicketContext = {
    title?: string;
    description?: string;
    descriptionPreview?: string;
  };

  type ChecklistItem = {
    id: string;
    text: string;
    severity?: string;
  };

  type Checklist = {
    checklistTitle?: string;
    items?: ChecklistItem[];
  };

  type QACopilotSupabaseConfig = {
    supabaseUrl: string;
    supabaseAnonKey: string;
  };

  type QACopilotAPI = {
    state: {
      settings: QASettings | null;
      lastIssueKey: string | null;
      lastChecklist: Checklist | null;
    };
    settings: {
      DEFAULT_SETTINGS: QASettings;
      save: (s: QASettings) => Promise<void>;
      load?: () => Promise<QASettings>;
    };
    panel: {
      renderIssue: (issueKey: string) => void;
      cleanup: () => void;
    };
    jiraParser: {
      extractTicketContext: (issueKey: string) => TicketContext;
    };
    acDetect: {
      detectAcceptanceCriteria: (title?: string, description?: string) => boolean;
    };
  };

  interface Window {
    QA_COPILOT?: Partial<QACopilotAPI>;
  }
}
