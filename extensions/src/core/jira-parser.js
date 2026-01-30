(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};
  const { dom } = window.QA_COPILOT;

  const DESCRIPTION_PLACEHOLDERS = new Set([
    "edit description",
    "add a description",
    "dodaj opis",
    "edytuj opis"
  ]);

  const normalizeDescription = (raw) => {
    const t = (raw || "").trim();
    if (!t) return "";
    if (DESCRIPTION_PLACEHOLDERS.has(dom.normalize(t))) return "";
    return t;
  };

  const findTitle = () => {
    const selectors = [
      'h1[data-testid="issue.views.issue-base.foundation.summary.heading"]',
      'h1[data-testid="issue.views.issue-base.foundation.summary.heading"] span',
      "h1"
    ];

    return dom.firstMatchText(selectors);
  };

  const findDescription = () => {
    const selectors = [
      '[data-testid="issue.views.field.rich-text.description"]',
      '[data-testid="issue.views.field.description"]',
      '[data-testid="issue.field.description"]',
      'div[data-field-id="description"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;

      const text = normalizeDescription(el.textContent);
      if (text) return text;
    }

    // fallback – paragrafy / listy
    const container = document.querySelector('div[data-field-id="description"]');
    if (container) {
      const blocks = [...container.querySelectorAll("p, li")]
        .map((n) => (n.textContent || "").trim())
        .filter(Boolean)
        .join("\n");

      return normalizeDescription(blocks);
    }

    return "";
  };

  const extractTicketContext = (issueKey) => {
    const title = findTitle();
    const description = findDescription();

    return {
      issueKey,
      title,
      description,
      descriptionPreview:
        description.length > 240 ? description.slice(0, 240) + "…" : description
    };
  };

  window.QA_COPILOT.jiraParser = {
    extractTicketContext
  };
})();
