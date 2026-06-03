import { useNavigate, useSearch } from '@tanstack/react-router';
import { Form, Input, Button, Card, Space, Switch, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchScrapper, updateScrapper } from '#/api/endpoints/scrappers';
import type { Scrapper } from '#/api/endpoints/scrappers';
import SelectorInput from './components/SelectorInput';

type EditFormValues = {
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
  item_selector: string | null;
  sel_domaine: string | null;
  sel_cuvee: string | null;
  sel_prix: string | null;
  sel_stock: string | null;
  urls_text: string;
  sel_image_json: string;
  sel_link_text: string;
  sel_category_text: string;
};

export function EditPage() {
  const { id } = useSearch({ from: '/edit' });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [scraper, setScraper] = useState<Scrapper | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
    if (!value || value.trim() === '') return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    const loadScraper = async () => {
      if (!id) return;

      setInitialLoading(true);
      try {
        const found = await fetchScrapper(String(id));
        setScraper(found);
        const csvTuple = found.scrapeData?.data.csv;
        const csvFields = csvTuple?.[1] ?? {};

        form.setFieldsValue({
          id: found.id,
          boutique_id: found.boutique_id,
          thecat: found.thecat,
          niveau: found.niveau,
          a_scraper: found.a_scraper,
          active: found.active,
          hour_cron: found.hour_cron,
          day_cron: found.day_cron ?? found.scrapeData?.day_cron ?? null,
          mode: found.mode ?? found.scrapeData?.mode ?? null,
          pagination: found.pagination ?? found.scrapeData?.pagination ?? null,
          load_more: found.load_more ?? found.scrapeData?.load_more ?? null,
          item_selector: (csvTuple?.[0] as string | null) ?? null,
          sel_domaine: (csvFields.domaine as string | null) ?? null,
          sel_cuvee: (csvFields.cuvee as string | null) ?? null,
          sel_prix: (csvFields.prix as string | null) ?? (csvFields.price as string | null) ?? null,
          sel_stock: (csvFields.stock as string | null) ?? null,
          urls_text: JSON.stringify(found.scrapeData?.url ?? [], null, 2),
          sel_image_json: JSON.stringify(csvFields.image ?? null, null, 2),
          sel_link_text: JSON.stringify(csvFields.link ?? csvFields.url ?? null, null, 2),
          sel_category_text: JSON.stringify(found.scrapeData?.data.category ?? null, null, 2),
        });
      } catch (error) {
        message.error('Erreur lors du chargement du scraper');
        console.error(error);
      } finally {
        setInitialLoading(false);
      }
    };

    void loadScraper();
  }, [id, form]);

  const handleSubmit = async (values: EditFormValues) => {
    if (!scraper) return;

    setLoading(true);
    try {
      const payload = {
        ...scraper,
        ...values,
        urls: parseJson<unknown[]>(values.urls_text, []),
        sel_image: parseJson<unknown>(values.sel_image_json, null),
        sel_link: parseJson<unknown>(values.sel_link_text, null),
        sel_category: parseJson<unknown>(values.sel_category_text, null),
      };

      await updateScrapper(scraper.id, {
        ...payload,
      });
      await queryClient.invalidateQueries({ queryKey: ['scrappers'] });
      message.success('Scraper modifié avec succès');
      navigate({ to: '/' });
    } catch (error) {
      message.error('Erreur lors de la modification');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6">
        <div className="edit-header">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate({ to: '/' })}>
            Retour
          </Button>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">{String(id)}</h1>
        </div>

        {initialLoading ? (
          <p>Chargement...</p>
        ) : scraper ? (
          <Card style={{ marginTop: '2rem' }}>
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Button type="primary" htmlType="submit" loading={loading} block className="button-save">
                Sauvegarder
              </Button>

              <div className="input-trois-colonnes">
                <Form.Item label="A scraper" name="a_scraper" valuePropName="checked" className="floating-label">
                  <Switch />
                </Form.Item>

                <Form.Item label="Actif" name="active" valuePropName="checked" className="floating-label">
                  <Switch />
                </Form.Item>
                <Form.Item label="Niveau" name="niveau" className="floating-label">
                  <Input type="number" />
                </Form.Item>
              </div>
              <div className="input-deux-colonnes">
                <Form.Item label="ID" name="id" className="floating-label">
                  <Input disabled />
                </Form.Item>

                <Form.Item label="Boutique ID" name="boutique_id" className="floating-label">
                  <Input type="number" />
                </Form.Item>
              </div>

              <Form.Item label="URLs (JSON array)" name="urls_text" className="floating-label">
                <Input.TextArea rows={4} />
              </Form.Item>

              <div className="input-deux-colonnes">
                <Form.Item label="Hour cron" name="hour_cron" className="floating-label">
                  <Input />
                </Form.Item>

                <Form.Item label="Day cron" name="day_cron" className="floating-label">
                  <Input />
                </Form.Item>
              </div>

              <div className="input-deux-colonnes">
                <Form.Item label="Mode" name="mode" className="floating-label">
                  <Input />
                </Form.Item>

                <Form.Item label="Catégorie" name="thecat" className="floating-label">
                  <Input />
                </Form.Item>
              </div>

              <Form.Item label="Pagination" name="pagination" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Load more" name="load_more" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Item selector" name="item_selector" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Sel domaine" name="sel_domaine" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Sel cuvee" name="sel_cuvee" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Sel prix" name="sel_prix" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="sel_image" name="sel_image_json" className="floating-label">
                <SelectorInput />
              </Form.Item>

              <Form.Item label="Sel link (JSON)" name="sel_link_text" className="floating-label">
                <SelectorInput />
              </Form.Item>

              <Form.Item label="Sel category (JSON)" name="sel_category_text" className="floating-label">
                <SelectorInput />
              </Form.Item>

              <Form.Item label="Sel stock" name="sel_stock" className="floating-label">
                <Input />
              </Form.Item>

              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Sauvegarder
                </Button>
                <Button onClick={() => navigate({ to: '/' })}>Annuler</Button>
              </Space>
            </Form>
          </Card>
        ) : (
          <p>Chargement...</p>
        )}
      </section>
    </main>
  );
}
