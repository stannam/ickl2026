'use strict';

const DATA_URL = './loanwords.json';

let loanwords = [];
let loanwordsByCorrectForm = new Map();

const numberFormatter = new Intl.NumberFormat('en-US');

document.addEventListener('DOMContentLoaded', initialiseApp);

async function initialiseApp() {
  setupTabs();
  setupListControls();
  setupInquiry();

  try {
    loanwords = await loadLoanwords();

    loanwordsByCorrectForm = new Map(
      loanwords.map((item) => [item.correct_form, item])
    );

    renderWordList();
  } catch (error) {
    console.error(error);

    setStatus(
      document.querySelector('#list-status'),
      'Could not load loanwords.json. Confirm that index.html, app.js, and loanwords.json are in the same directory.',
      true
    );

    setStatus(
      document.querySelector('#inquiry-status'),
      'The data file could not be loaded.',
      true
    );
  }
}

async function loadLoanwords() {
  const response = await fetch(DATA_URL, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load ${DATA_URL}: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new TypeError(
      'loanwords.json must contain a JSON array.'
    );
  }

  data.forEach(validateLoanwordRecord);

  return data;
}

function validateLoanwordRecord(item, index) {
  const requiredKeys = [
    'correct_form',
    'correct_frequency',
    'deviant_forms',
    'deviant_frequency',
    'total_frequency',
    'confusion_rate'
  ];

  for (const key of requiredKeys) {
    if (!(key in item)) {
      throw new TypeError(
        `Record ${index + 1} is missing the key "${key}".`
      );
    }
  }

  if (typeof item.correct_form !== 'string') {
    throw new TypeError(
      `Record ${index + 1}: correct_form must be a string.`
    );
  }

  if (!Array.isArray(item.deviant_forms)) {
    throw new TypeError(
      `Record ${index + 1}: deviant_forms must be an array.`
    );
  }
}

function setupTabs() {
  const tabs = Array.from(
    document.querySelectorAll('[role="tab"]')
  );

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      activateTab(tab, tabs);
    });

    tab.addEventListener('keydown', (event) => {
      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight'
      ) {
        return;
      }

      event.preventDefault();

      const direction =
        event.key === 'ArrowRight' ? 1 : -1;

      const currentIndex = tabs.indexOf(tab);

      const nextIndex =
        (currentIndex + direction + tabs.length) %
        tabs.length;

      activateTab(tabs[nextIndex], tabs);
      tabs[nextIndex].focus();
    });
  }
}

function activateTab(selectedTab, allTabs) {
  for (const tab of allTabs) {
    const isSelected = tab === selectedTab;

    const panel = document.getElementById(
      tab.getAttribute('aria-controls')
    );

    tab.setAttribute(
      'aria-selected',
      String(isSelected)
    );

    tab.tabIndex = isSelected ? 0 : -1;
    panel.hidden = !isSelected;
  }
}

function setupListControls() {
  const form = document.querySelector('#list-form');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    renderWordList();
  });
}

function renderWordList() {
  const status =
    document.querySelector('#list-status');

  const tableBody =
    document.querySelector('#word-list-body');

  tableBody.replaceChildren();

  if (loanwords.length === 0) {
    setStatus(
      status,
      'No data are available.',
      true
    );

    return;
  }

  const requestedCount = readNonNegativeInteger(
    document.querySelector('#top-count'),
    {
      minimum: 1
    }
  );

  if (requestedCount === null) {
    setStatus(
      status,
      'Enter a whole number of words greater than 0.',
      true
    );

    return;
  }

  const results = sortByConfusionRate(loanwords).slice(
    0,
    requestedCount
  );

  setStatus(
    status,
    `Showing ${numberFormatter.format(results.length)} highest-CR word${results.length === 1 ? '' : 's'}.`
  );

  const fragment =
    document.createDocumentFragment();

  results.forEach((item, index) => {
    fragment.append(
      createWordListRow(item, index + 1)
    );
  });

  tableBody.append(fragment);
}

function createWordListRow(item, serialNumber) {
  const row = document.createElement('tr');

  appendCell(row, serialNumber, true);

  appendCell(
    row,
    item.correct_form
  );

  appendCell(
    row,
    numberFormatter.format(
      item.correct_frequency
    ),
    true
  );

  appendCell(
    row,
    formatDeviantFormList(
      item.deviant_forms
    )
  );

  appendCell(
    row,
    numberFormatter.format(
      item.deviant_frequency
    ),
    true
  );

  appendCell(
    row,
    formatPercentage(
      item.confusion_rate
    ),
    true
  );

  return row;
}

function formatDeviantFormList(deviantForms) {
  if (deviantForms.length === 0) {
    return '—';
  }

  return deviantForms
    .map((item) => item.form)
    .join(', ');
}

function appendCell(
  row,
  value,
  numeric = false
) {
  const cell =
    document.createElement('td');

  cell.textContent = String(value);

  if (numeric) {
    cell.classList.add('numeric');
  }

  row.append(cell);
}

function sortByConfusionRate(items) {
  return [...items].sort((a, b) => {
    const byConfusionRate =
      b.confusion_rate -
      a.confusion_rate;

    if (byConfusionRate !== 0) {
      return byConfusionRate;
    }

    const byTotalFrequency =
      b.total_frequency -
      a.total_frequency;

    if (byTotalFrequency !== 0) {
      return byTotalFrequency;
    }

    return a.correct_form.localeCompare(
      b.correct_form,
      'ko'
    );
  });
}

function setupInquiry() {
  const form =
    document.querySelector('#inquiry-form');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    renderIndividualWord();
  });
}

function renderIndividualWord() {
  const queryInput =
    document.querySelector('#word-query');

  const query =
    queryInput.value.trim();

  const status =
    document.querySelector('#inquiry-status');

  const resultContainer =
    document.querySelector('#word-result');

  resultContainer.hidden = true;

  if (query === '') {
    setStatus(
      status,
      'Enter a correct form.',
      true
    );

    queryInput.focus();

    return;
  }

  const item =
    loanwordsByCorrectForm.get(query);

  if (!item) {
    setStatus(
      status,
      `No entry was found for the correct form “${query}”.`,
      true
    );

    return;
  }

  setStatus(status, '');

  document.querySelector(
    '#result-correct-form'
  ).textContent =
    item.correct_form;

  document.querySelector(
    '#result-correct-frequency'
  ).textContent =
    numberFormatter.format(
      item.correct_frequency
    );

  document.querySelector(
    '#result-total-frequency'
  ).textContent =
    numberFormatter.format(
      item.total_frequency
    );

  document.querySelector(
    '#result-confusion-rate'
  ).textContent =
    formatPercentage(
      item.confusion_rate
    );

  renderDeviantForms(
    item.deviant_forms
  );

  resultContainer.hidden = false;
}

function renderDeviantForms(deviantForms) {
  const tableWrap =
    document.querySelector(
      '#deviant-table-wrap'
    );

  const tableBody =
    document.querySelector(
      '#deviant-form-body'
    );

  const emptyNote =
    document.querySelector(
      '#no-deviant-note'
    );

  tableBody.replaceChildren();

  if (deviantForms.length === 0) {
    tableWrap.hidden = true;
    emptyNote.hidden = false;

    return;
  }

  tableWrap.hidden = false;
  emptyNote.hidden = true;

  const sortedForms =
    [...deviantForms].sort((a, b) => {
      const byFrequency =
        b.frequency -
        a.frequency;

      if (byFrequency !== 0) {
        return byFrequency;
      }

      return a.form.localeCompare(
        b.form,
        'ko'
      );
    });

  const fragment =
    document.createDocumentFragment();

  for (const item of sortedForms) {
    const row =
      document.createElement('tr');

    appendCell(
      row,
      item.form
    );

    appendCell(
      row,
      numberFormatter.format(
        item.frequency
      ),
      true
    );

    fragment.append(row);
  }

  tableBody.append(fragment);
}

function readNonNegativeInteger(
  input,
  {
    minimum
  }
) {
  const value = Number(input.value);

  if (
    !Number.isInteger(value) ||
    value < minimum
  ) {
    return null;
  }

  return value;
}

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

function setStatus(
  element,
  message,
  isError = false
) {
  element.textContent = message;

  element.classList.toggle(
    'error',
    isError
  );
}
