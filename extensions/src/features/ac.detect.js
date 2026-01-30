(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};
  const { dom } = window.QA_COPILOT;

  const isACPresentInJiraFieldsDom = (synonyms) => {
    const needles = (synonyms || [])
      .map((s) => dom.normalize(s))
      .filter(Boolean);

    if (!needles.length) return false;

    const divs = Array.from(document.querySelectorAll("div"))
      .filter((el) => {
        const t = dom.normalize(el.innerText);
        return needles.some((n) => t.includes(n));
      })
      .sort((a, b) => (a.innerText?.length || 0) - (b.innerText?.length || 0))
      .slice(0, 80);

    if (!divs.length) return false;

    const best = divs[0];
    return (best?.innerText?.length || 0) < 2000;
  };

  const hasACInDescription = (title, description, synonyms) => {
    const hay = dom.normalize(`${title}\n${description}`);

    const needles = (synonyms || [])
      .map((s) => dom.normalize(s))
      .filter(Boolean);

    const synonymHit = needles.some((n) => hay.includes(n));

    const checklistHit =
      hay.includes("- [ ]") ||
      hay.includes("* [ ]") ||
      /\n-\s+/.test(hay) ||
      /\n\*\s+/.test(hay) ||
      /\n\d+\.\s+/.test(hay);

    return synonymHit || checklistHit;
  };

  const hasGherkin = (title, description) => {
    const hay = dom.normalize(`${title}\n${description}`);
    return hay.includes("given") && hay.includes("when") && hay.includes("then");
  };

  const detectAcceptanceCriteria = (title, description) => {
    const s = window.QA_COPILOT.state?.settings || {};
    const syn = s.acSynonyms || [];

    const fromDom = !!(s.detectFromJiraFieldsDom && isACPresentInJiraFieldsDom(syn));
    const fromDesc = !!(s.detectFromDescription && hasACInDescription(title, description, syn));
    const fromGherkin = !!(s.detectFromGherkin && hasGherkin(title, description));

    // Debug: super przydatne w Jira SPA
    console.log("[QA Copilot] AC detection:", { fromDom, fromDesc, fromGherkin, syn });

    // MVP: wystarczy jeden sygnał
    return fromDom || fromDesc || fromGherkin;
  };

  window.QA_COPILOT.acDetect = {
    detectAcceptanceCriteria
  };
})();
