import { useNavigate } from '@tanstack/react-router';
import { Form, Input, Button, Card, Space, Switch, message, Modal } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchScrapper, createScrapper, updateScrapper, deleteScrapper } from '#/api/endpoints/scrappers';
import type { Scrapper } from '#/api/endpoints/scrappers';
import SelectorInput from './components/SelectorInput';

type FormValues = {
  id: string;
  boutique_id: number | null;
  thecat: string | null;
  niveau: number | null;
  a_scraper: boolean;
  active: boolean;
  hour_cron: string | null;
  day_cron: string | null;
  mode: string | null;
  pagination: string | null;
  load_more: string | null;
  add_url_image: string | null;
  add_url: string | null;
  item_selector: string | null;
  sel_domaine: string | null;
  sel_cuvee: string | null;
  sel_prix: string | null;
  sel_stock: string | null;
  urls_text: string;
  sel_image_json: string | null;
  sel_link_text: string | null;
  sel_category: string | null;
};

// ─── Config du formulaire : une ligne = un groupe affiché côte à côte ────────
// "cols" fixe la classe CSS de la ligne (1, 2 ou 3 colonnes).

type FieldKind = 'text' | 'number' | 'switch' | 'textarea' | 'selector' | 'disabled';

type FieldDef = {
  name: keyof FormValues;
  label: string;
  kind?: FieldKind;
  editOnly?: boolean; // affiché uniquement en mode édition
};

const FORM_ROWS: FieldDef[][] = [
  [
    { name: 'a_scraper', label: 'A scraper', kind: 'switch' },
    { name: 'active', label: 'Actif', kind: 'switch' },
    { name: 'niveau', label: 'Niveau', kind: 'number' },
  ],
  [
    { name: 'id', label: 'ID', kind: 'disabled', editOnly: true },
    { name: 'boutique_id', label: 'Boutique ID', kind: 'number' },
  ],
  [{ name: 'urls_text', label: 'URLs (JSON array)', kind: 'textarea' }],
  [
    { name: 'hour_cron', label: 'Hour cron' },
    { name: 'day_cron', label: 'Day cron' },
  ],
  [
    { name: 'mode', label: 'Mode' },
    { name: 'thecat', label: 'Catégorie' },
  ],
  [{ name: 'pagination', label: 'Pagination (ex: .next[rel=next])' }],
  [{ name: 'load_more', label: 'Load more (ex: .load-more-btn[data-load])' }],
  [{ name: 'item_selector', label: 'Item selector' }],
  [{ name: 'sel_domaine', label: 'Sel domaine' }],
  [{ name: 'sel_cuvee', label: 'Sel cuvee' }],
  [{ name: 'sel_prix', label: 'Sel prix' }],
  [{ name: 'sel_image_json', label: 'sel_image', kind: 'selector' }],
  [{ name: 'sel_link_text', label: 'Sel link (JSON)', kind: 'selector' }],
  [
    { name: 'sel_stock', label: 'Sel stock' },
    { name: 'sel_category', label: 'Domaine en dur' },
  ],
  [
    { name: 'add_url_image', label: 'Add URL image' },
    { name: 'add_url', label: 'Add URL' },
  ],
];

const ROW_CLASS: Record<number, string> = {
  2: 'input-deux-colonnes',
  3: 'input-trois-colonnes',
};

const renderControl = (kind: FieldKind = 'text') => {
  switch (kind) {
    case 'switch':
      return <Switch />;
    case 'number':
      return <Input type="number" />;
    case 'textarea':
      return <Input.TextArea rows={4} />;
    case 'selector':
      return <SelectorInput />;
    case 'disabled':
      return <Input disabled />;
    default:
      return <Input />;
  }
};

const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value || value.trim() === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const ADD_INITIAL_VALUES: Partial<FormValues> = {
  a_scraper: false,
  active: true,
  urls_text: JSON.stringify([], null, 2),
  sel_image_json: JSON.stringify(null, null, 2),
  sel_link_text: JSON.stringify(null, null, 2),
};

const scrapperToFormValues = (found: Scrapper): FormValues => ({
  id: found.id,
  boutique_id: found.boutique_id,
  thecat: found.thecat,
  niveau: found.scrapper_niveau ?? found.niveau,
  a_scraper: found.a_scraper,
  active: found.active,
  hour_cron: found.hour_cron,
  day_cron: found.day_cron,
  mode: found.mode,
  pagination: found.pagination,
  load_more: found.load_more,
  add_url_image: found.add_url_image,
  add_url: found.add_url,
  item_selector: found.item_selector,
  sel_domaine: found.sel_domaine,
  sel_cuvee: found.sel_cuvee,
  sel_prix: found.sel_prix,
  sel_stock: found.sel_stock,
  urls_text: JSON.stringify(found.urls ?? [], null, 2),
  sel_image_json: JSON.stringify(found.sel_image ?? null, null, 2),
  sel_link_text: JSON.stringify(found.sel_link ?? null, null, 2),
  sel_category: found.sel_category,
});

type Props = { id?: string };

export function EditPage({ id }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [scraper, setScraper] = useState<Scrapper | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);

  const isEdit = !!id;

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const found = await fetchScrapper(id);
        setScraper(found);
        form.setFieldsValue(scrapperToFormValues(found));
      } catch {
        message.error('Erreur lors du chargement du scraper');
      } finally {
        setInitialLoading(false);
      }
    };
    void load();
  }, [id, form]);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const parsed = {
        urls: parseJson<string[]>(values.urls_text, []),
        sel_image: parseJson<string | null>(values.sel_image_json, null),
        sel_link: parseJson<string | null>(values.sel_link_text, null),
      };

      if (isEdit && scraper) {
        await updateScrapper(scraper.id, { ...scraper, ...values, ...parsed });
        message.success('Scraper modifié avec succès');
      } else {
        await createScrapper({ ...values, ...parsed });
        message.success('Scraper créé avec succès');
      }

      await queryClient.invalidateQueries({ queryKey: ['scrappers'] });
      navigate({ to: '/' });
    } catch {
      message.error(isEdit ? 'Erreur lors de la modification' : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!scraper) return;
    Modal.confirm({
      title: `Supprimer ${scraper.nom_boutique || `ID: ${id}`} ?`,
      okText: 'Supprimer',
      okType: 'danger',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await deleteScrapper(scraper.id);
          await queryClient.invalidateQueries({ queryKey: ['scrappers'] });
          message.success('Scraper supprimé avec succès');
          navigate({ to: '/' });
        } catch {
          message.error('Erreur lors de la suppression');
        }
      },
    });
  };

  const rows = FORM_ROWS.map((row) => row.filter((f) => !f.editOnly || isEdit)).filter((r) => r.length > 0);

  const title = isEdit ? scraper?.nom_boutique || `ID: ${id}` : 'Ajouter une boutique';

  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6">
        <div className={isEdit ? 'edit-header' : 'add-header'}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate({ to: '/' })}>
            Retour
          </Button>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">{title}</h1>
          {isEdit && (
            <Button type="primary" danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Supprimer
            </Button>
          )}
        </div>

        {initialLoading ? (
          <p>Chargement...</p>
        ) : (
          <Card style={{ marginTop: '2rem' }}>
            <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={isEdit ? undefined : ADD_INITIAL_VALUES}>
              <Button type="primary" htmlType="submit" loading={loading} block className="button-save">
                {isEdit ? 'Sauvegarder' : 'Créer'}
              </Button>

              {rows.map((row) => (
                <div key={row.map((f) => f.name).join('-')} className={ROW_CLASS[row.length]}>
                  {row.map(({ name, label, kind }) => (
                    <Form.Item
                      key={name}
                      label={label}
                      name={name}
                      valuePropName={kind === 'switch' ? 'checked' : 'value'}
                      className="floating-label"
                    >
                      {renderControl(kind)}
                    </Form.Item>
                  ))}
                </div>
              ))}

              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {isEdit ? 'Sauvegarder' : 'Créer'}
                </Button>
                <Button onClick={() => navigate({ to: '/' })}>Annuler</Button>
              </Space>
            </Form>
          </Card>
        )}
      </section>
    </main>
  );
}

export function AddPage() {
  return <EditPage />;
}
