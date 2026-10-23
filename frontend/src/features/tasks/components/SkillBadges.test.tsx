import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeTask } from '../../../test/fixtures';
import { SkillBadges } from './SkillBadges';

describe('SkillBadges', () => {
  it('marks LLM-detected skills as AI, with an accessible description', () => {
    render(<SkillBadges task={makeTask({ skillSource: 'LLM' })} />);
    expect(screen.getByText('AI')).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.getByText('Skills detected by AI from the title'),
    ).toBeInTheDocument();
  });

  it('labels keyword-rule results as Auto, not AI', () => {
    render(<SkillBadges task={makeTask({ skillSource: 'FALLBACK' })} />);
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(
      screen.getByText('Skills detected by keyword rules (AI unavailable)'),
    ).toBeInTheDocument();
  });

  it('shows no marker for skills the user chose', () => {
    render(<SkillBadges task={makeTask({ skillSource: 'USER' })} />);
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Skills' })).toHaveTextContent(
      'Frontend',
    );
  });
});
