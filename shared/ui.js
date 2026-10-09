// Presentation-only helpers. No storage, messages or authentication decisions.
export function initializePasswords() {
  for (const input of document.querySelectorAll('input[type="password"]')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.dataset.password = 'true';
    input.replaceWith(wrapper);
    wrapper.append(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-controls', input.id);
    toggle.setAttribute('aria-pressed', 'false');
    const label = document.querySelector(`label[for="${input.id}"]`)?.textContent || 'password';
    toggle.setAttribute('aria-label', `Show ${label.toLowerCase()}`);
    const hide = () => {
      input.type = 'password'; toggle.textContent = 'Show';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', `Show ${label.toLowerCase()}`);
    };
    toggle.addEventListener('click', () => {
      if (input.type === 'text') hide();
      else {
        input.type = 'text'; toggle.textContent = 'Hide';
        toggle.setAttribute('aria-pressed', 'true');
        toggle.setAttribute('aria-label', `Hide ${label.toLowerCase()}`);
      }
    });
    input.form?.addEventListener('submit', hide);
    wrapper.append(toggle);
  }
}

export function initializeDialog(backdrop, page, close) {
  let previousFocus = null;
  const controls = () => [...backdrop.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
  const observer = new MutationObserver(() => {
    if (!backdrop.hidden) {
      previousFocus = document.activeElement;
      page.inert = true;
      controls()[0]?.focus();
    } else {
      page.inert = false;
      if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus();
    }
  });
  observer.observe(backdrop, {attributes: true, attributeFilter: ['hidden']});
  backdrop.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!document.getElementById('modal-confirm').disabled) close(); }
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault(); document.getElementById('modal-confirm').click();
    }
    if (event.key === 'Tab') {
      const items = controls(); const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
}

export function clearPasswords(scope = document) {
  for (const input of scope.querySelectorAll('[data-password]')) {
    if (input.type === 'text') input.parentElement.querySelector('.password-toggle').click();
    input.value = '';
  }
}
