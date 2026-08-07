import { useNavigate } from '@tanstack/react-router';
import { Form, Input, Button, Card, Space, Switch, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createScrapper } from '#/api/endpoints/scrappers';
import SelectorInput from './components/SelectorInput';

type AddFormValues = {
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
  sel_image_json: string;
  sel_link_text: string;
  sel_category: string;
};

export function AddPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
    if (!value || value.trim() === '') return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  // Initialize form with default values
  form.setFieldsValue({
    a_scraper: false,
    active: true,
    niveau: null,
    urls_text: JSON.stringify([], null, 2),
    sel_image_json: JSON.stringify(null, null, 2),
    sel_link_text: JSON.stringify(null, null, 2),
  });

  const handleSubmit = async (values: AddFormValues) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        urls: parseJson<unknown[]>(values.urls_text, []),
        sel_image: parseJson<unknown>(values.sel_image_json, null),
        sel_link: parseJson<unknown>(values.sel_link_text, null),
      };

      await createScrapper(payload);
      await queryClient.invalidateQueries({ queryKey: ['scrappers'] });
      message.success('Scraper créé avec succès');
      navigate({ to: '/' });
    } catch (error) {
      message.error('Erreur lors de la création');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6">
        <div className="add-header">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate({ to: '/' })}>
            Retour
          </Button>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">Ajouter une boutique</h1>
        </div>

        <Card style={{ marginTop: '2rem' }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Button type="primary" htmlType="submit" loading={loading} block className="button-save">
              Créer
            </Button>

            <div className="input-trois-colonnes">
              <Form.Item label="A scraper" name="a_scraper" valuePropName="checked" className="floating-label">
                <Switch />
              </Form.Item>

              <Form.Item label="Actif" name="active" valuePropName="checked" className="floating-label">
                <Switch />
              </Form.Item>
              <Form.Item 
                label="Niveau" 
                name="niveau" 
                className="floating-label"
                rules={[{ required: true, message: 'Le niveau est obligatoire' }]}
              >
                <Input type="number" />
              </Form.Item>
            </div>

            <div className="input-deux-colonnes">
              <Form.Item label="Boutique ID" name="boutique_id" className="floating-label">
                <Input type="number" />
              </Form.Item>

              <Form.Item label="Catégorie" name="thecat" className="floating-label">
                <Input />
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

              <Form.Item label="Pagination (ex: .next[rel=next])" name="pagination" className="floating-label">
                <Input />
              </Form.Item>
            </div>

            <Form.Item label="Load more (ex: .load-more-btn[data-load])" name="load_more" className="floating-label">
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

            <div className="input-deux-colonnes">
              <Form.Item label="Sel stock" name="sel_stock" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Domaine en dur" name="sel_category" className="floating-label">
                <Input />
              </Form.Item>
            </div>

            <h2>Les url à rajouter si les scraps sont en relatif</h2>
            <div className="input-deux-colonnes">
              <Form.Item label="Add URL image" name="add_url_image" className="floating-label">
                <Input />
              </Form.Item>

              <Form.Item label="Add URL" name="add_url" className="floating-label">
                <Input />
              </Form.Item>
            </div>

            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Créer
              </Button>
              <Button onClick={() => navigate({ to: '/' })}>Annuler</Button>
            </Space>
          </Form>
        </Card>
      </section>
    </main>
  );
}
