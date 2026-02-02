export {};

declare global {
  type QASettings = {
    acSynonyms?: string[];
    detectFromJiraFieldsDom?: boolean;
    detectFromDescription?: boolean;
    detectFromGherkin?: boolean;
  };

  type QACopilotState = {
    settings?: QASettings;
    lastIssueKey?: string;
    lastChecklist?: any;
    testcasesByItemId?: Record<string, any>;
    lastGeneratedTestcase?: any;
  };

  type QACopilotGlobal = {
    state?: QACopilotState;

    panel?: {
      renderIssue: (issueKey: string) => void;
      cleanup: () => void;
    };

    settings?: {
      DEFAULT_SETTINGS: QASettings;
      save: (s: QASettings) => Promise<void>;
      load?: () => Promise<QASettings>;
    };

    jiraParser?: {
      extractTicketContext: (issueKey: string) => {
        title?: string;
        description?: string;
        descriptionPreview?: string;
      };
    };

    acDetect?: {
      detectAcceptanceCriteria: (title?: string, description?: string) => boolean;
    };

    [key: string]: any;
  };

  interface Window {
    QA_COPILOT?: QACopilotGlobal;
  }
}
