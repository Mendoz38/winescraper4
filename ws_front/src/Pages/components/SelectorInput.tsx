import { Button, Input } from 'antd';

type Props = { value?: string; onChange?: (v: string) => void };

export default function SelectorInput({ value, onChange }: Props) {
  const parsed = value ? (JSON.parse(value) ?? {}) : {};
  const selector = parsed.selector ?? '';
  const attr = parsed.scrape?.[1] ?? '';
  const hasAttr = !!parsed.scrape;

  const emit = (sel: string, atr: string) => onChange?.(JSON.stringify(atr ? { selector: sel, scrape: ['attr', atr] } : { selector: sel }));

  return (
    <div className="input-deux-colonnes">
      <div className="attr">
        <Input value={selector} onChange={(e) => emit(e.target.value, attr)} placeholder="Sélecteur CSS" />
        <Button type={hasAttr ? 'primary' : 'default'} onClick={() => emit(selector, hasAttr ? '' : 'src')}>
          attr
        </Button>
      </div>
      {hasAttr && <Input value={attr} onChange={(e) => emit(selector, e.target.value)} placeholder="ex: src, href…" />}
    </div>
  );
}
