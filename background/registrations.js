import {buildOriginPatterns} from '../shared/utils.js';

export function lockRegistration(domain) {
  return {
    id: 'padlox-' + domain,
    matches: buildOriginPatterns(domain),
    js: ['content/lock.js'],
    runAt: 'document_start',
    world: 'ISOLATED',
    allFrames: false,
    persistAcrossSessions: true
  };
}

export function isLockRegistration(script, domain) {
  const expected = lockRegistration(domain);
  return script.id === expected.id &&
    JSON.stringify([...(script.matches || [])].sort()) === JSON.stringify([...expected.matches].sort()) &&
    JSON.stringify(script.js) === JSON.stringify(expected.js) &&
    script.runAt === expected.runAt &&
    (script.world || 'ISOLATED') === 'ISOLATED' &&
    !script.allFrames && script.persistAcrossSessions !== false &&
    !(script.excludeMatches?.length) && !(script.css?.length);
}
