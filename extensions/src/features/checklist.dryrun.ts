(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};
  const { dom } = window.QA_COPILOT;

  const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

  const inferDomainHints = (text) => {
    const t = dom.normalize(text);
    const hints = [];

    if (t.includes("login") || t.includes("auth") || t.includes("signin") || t.includes("zalog"))
      hints.push("auth");
    if (t.includes("payment") || t.includes("refund") || t.includes("invoice") || t.includes("płat"))
      hints.push("payments");
    if (t.includes("role") || t.includes("permission") || t.includes("uprawn"))
      hints.push("permissions");
    if (t.includes("upload") || t.includes("file") || t.includes("attachment") || t.includes("plik"))
      hints.push("upload");
    if (t.includes("email") || t.includes("mail"))
      hints.push("email");
    if (t.includes("search") || t.includes("filter") || t.includes("sort") || t.includes("wyszuk"))
      hints.push("search");
    if (t.includes("api") || t.includes("endpoint") || t.includes("backend"))
      hints.push("api");
    if (t.includes("ui") || t.includes("layout") || t.includes("responsive") || t.includes("mobile"))
      hints.push("ui");

    return hints;
  };

  const generateChecklistDryRun = ({ title, description, hasAC }) => {
    const base = [
      "Happy path: feature działa zgodnie z opisem",
      "Negatywny scenariusz: brak danych / błędne dane",
      "Obsługa błędów: czytelny komunikat, brak crasha",
      "Regresja: czy nie popsuło podobnych flowów",
      "Edge cases: puste wartości, duże wartości, znaki specjalne",
      "Spójność UI: loading, disabled states, brak migotania",
      "Responsywność: kontrola w wąskim widoku"
    ];

    const warnings = [];
    if (!description) warnings.push("Uzupełnij opis (bez tego testy to wróżenie z fusów)");
    if (!hasAC) warnings.push("Dodaj Acceptance Criteria (min. 2–3 punkty)");

    const hints = inferDomainHints(`${title}\n${description}`);
    const domain = [];

    if (hints.includes("auth")) domain.push(
      "Auth: poprawne przekierowania po zalogowaniu/wylogowaniu",
      "Auth: błędne hasło / brak dostępu → poprawny komunikat",
      "Auth: odświeżenie strony (F5) nie psuje sesji"
    );

    if (hints.includes("payments")) domain.push(
      "Payments: poprawne kwoty, waluty, rounding",
      "Payments: double submit / retry nie robi duplikatów",
      "Payments: statusy transakcji poprawnie się aktualizują"
    );

    if (hints.includes("permissions")) domain.push(
      "Permissions: user bez uprawnień → blokada + jasny komunikat",
      "Permissions: role edge-case (np. viewer/editor) zachowują się poprawnie"
    );

    if (hints.includes("upload")) domain.push(
      "Upload: limity rozmiaru i typy plików",
      "Upload: przerwanie uploadu / ponowienie",
      "Upload: nazwy plików ze znakami specjalnymi"
    );

    if (hints.includes("search")) domain.push(
      "Search: kombinacje filtrów, sort + paginacja",
      "Search: brak wyników → poprawny empty state",
      "Search: wydajność na większej liście"
    );

    if (hints.includes("api")) domain.push(
      "API: obsługa 4xx/5xx + timeouty",
      "API: kontrakt response (schema) zgodny z oczekiwaniami",
      "API: retry/backoff (jeśli jest) działa poprawnie"
    );

    if (hints.includes("ui")) domain.push(
      "UI: overflow na długich tekstach",
      "UI: focus/Tab (podstawowa a11y)",
      "UI: ciemny motyw (jeśli jest) / kontrasty"
    );

    const out = [
      ...warnings.map((w) => `⚠️ ${w}`),
      ...base,
      ...domain
    ];

    return uniq(out);
  };

  window.QA_COPILOT.checklist = {
    generateChecklistDryRun
  };
})();
