import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import SelectorInput from '../../../Pages/components/SelectorInput';

describe('SelectorInput', () => {
  it('affiche sélecteur et attr quand présent', () => {
    render(<SelectorInput value={JSON.stringify({ selector: '.card', scrape: ['attr', 'href'] })} />);

    expect(screen.getByDisplayValue('.card')).toBeTruthy();
    expect(screen.getByDisplayValue('href')).toBeTruthy();
  });

  it('active puis modifie attr', () => {
    const onChange = vi.fn();

    function Host() {
      const [value, setValue] = useState(JSON.stringify({ selector: '.img' }));

      return (
        <SelectorInput
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }

    render(<Host />);

    fireEvent.click(screen.getByRole('button', { name: 'attr' }));
    expect(onChange).toHaveBeenCalledWith(JSON.stringify({ selector: '.img', scrape: ['attr', 'src'] }));

    const attrInput = screen.getByPlaceholderText('ex: src, href…');
    fireEvent.change(attrInput, { target: { value: 'data-src' } });
    expect(onChange).toHaveBeenLastCalledWith(JSON.stringify({ selector: '.img', scrape: ['attr', 'data-src'] }));
  });
});
