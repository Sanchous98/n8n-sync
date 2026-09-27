import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationServiceEnabled } from '../../src/incontainer/engine';

test('publication-guard: enabled when the flag is on', () => {
  assert.equal(publicationServiceEnabled({ useWorkflowPublicationService: true }), true);
});

test('publication-guard: only an explicit false disables it', () => {
  assert.equal(publicationServiceEnabled({ useWorkflowPublicationService: false }), false);
});

test('publication-guard: absent config defaults to enabled (matches n8n)', () => {
  // Current n8n defaults N8N_USE_WORKFLOW_PUBLICATION_SERVICE to true, so a missing/unknown field
  // must NOT be treated as "disabled" — that would produce a spurious warning on every import.
  assert.equal(publicationServiceEnabled({}), true);
  assert.equal(publicationServiceEnabled(undefined), true);
});
