import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Table, Button, Space, Input } from 'antd';
import { EyeOutlined, DownloadOutlined, ThunderboltOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';
import { useScrappers } from '#/api/hooks/useScrappers';

dayjs.extend(relativeTime);
dayjs.locale('fr');

interface Scraper {
  id: string | number;
  boutique_id: number | null;
  nom_boutique: string | null;
  en_ligne: boolean | null;
  payant: boolean | null;
  retrait: boolean | null;
  thecat: string | null;
  niveau: number | null;
  a_scraper: boolean;
  active: boolean;
  last_run: string | null;
  scrapeData?: {
    url?: string[];
  };
}

export function ListPage() {
  const { items, loading, error, refresh } = useScrappers();
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  const [boutiqueFilter, setBoutiqueFilter] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const filteredItems = items.filter((item) => {
    if (!boutiqueFilter) return true;
    return (item.nom_boutique ?? '').toLowerCase().includes(boutiqueFilter.toLowerCase());
  });

  const handleView = (id: string | number) => {
    window.open(`${apiBase}/scrap/${id}/view`, '_blank');
  };

  const handleDownload = (id: string | number, name: string) => {
    window.location.href = `${apiBase}/scrap/${id}/download?name=${encodeURIComponent(name)}`;
  };
  const handleScrape = async (id: string | number) => {
    await fetch(`${apiBase}/scrap/${id}/run`);
    await refresh();
  };

  const handleEditClick = (id: string | number) => {
    navigate({ to: '/edit', search: { id } });
  };

  const getTextValue = (value: unknown) => (value === null || value === undefined ? '' : String(value));

  const formatLastRun = (value: string | null) => {
    if (!value) return '-';
    return isHydrated ? dayjs(value).fromNow() : dayjs(value).format('YYYY-MM-DD HH:mm');
  };

  const getColumnSearchProps = (accessor: (record: Scraper) => unknown) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div className="filter-dropdown">
        <Input
          placeholder="Rechercher"
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          className="filter-input"
        />
        <Space>
          <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm()}>
            OK
          </Button>
          <Button
            size="small"
            onClick={() => {
              clearFilters?.();
              confirm();
            }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <SearchOutlined className={filtered ? 'filter-icon' : ''} />,
    onFilter: (value: any, record: Scraper) => getTextValue(accessor(record)).toLowerCase().includes(String(value).toLowerCase()),
  });

  const columns: any[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      className: 'table-id-col',
      sorter: (a: Scraper, b: Scraper) =>
        String(a.id).localeCompare(String(b.id), undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      ...getColumnSearchProps((record: Scraper) => record.id),
      render: (value: string | number) => (
        <span onClick={() => handleEditClick(value)} className="table-id-text">
          {value}
        </span>
      ),
    },
    {
      title: 'Boutique',
      key: 'boutique',
      sorter: (a: Scraper, b: Scraper) =>
        String(a.nom_boutique ?? '').localeCompare(String(b.nom_boutique ?? ''), 'fr', { sensitivity: 'base' }),
      render: (_: unknown, record: Scraper) =>
        record.nom_boutique ? (
          <span onClick={() => handleEditClick(record.id)} className="table-id-text">
            {record.nom_boutique}
          </span>
        ) : (
          <span onClick={() => handleEditClick(record.id)} className="table-id-text">
            --
          </span>
        ),
    },
    {
      title: 'En ligne',
      dataIndex: 'en_ligne',
      key: 'en_ligne',
      sorter: (a: Scraper, b: Scraper) => Number(a.en_ligne ?? -1) - Number(b.en_ligne ?? -1),
      render: (value: boolean | null) => (value === null ? '-' : value ? 'Oui' : 'Non'),
    },
    {
      title: 'Payant',
      dataIndex: 'payant',
      key: 'payant',
      sorter: (a: Scraper, b: Scraper) => Number(a.payant ?? -1) - Number(b.payant ?? -1),
      render: (value: boolean | null) => (value === null ? '-' : value ? 'Oui' : 'Non'),
    },
    {
      title: 'Retrait',
      dataIndex: 'retrait',
      key: 'retrait',
      sorter: (a: Scraper, b: Scraper) => Number(a.retrait ?? -1) - Number(b.retrait ?? -1),
      render: (value: boolean | null) => (value === null ? '-' : value ? 'Oui' : 'Non'),
    },
    {
      title: 'Cat',
      dataIndex: 'thecat',
      key: 'thecat',
      sorter: (a: Scraper, b: Scraper) =>
        String(a.thecat ?? '').localeCompare(String(b.thecat ?? ''), 'fr', {
          sensitivity: 'base',
        }),
      ...getColumnSearchProps((record: Scraper) => record.thecat ?? ''),
      render: (value: string | null) => value ?? '-',
    },
    {
      title: 'Scrap',
      dataIndex: 'a_scraper',
      key: 'a_scraper',
      sorter: (a: Scraper, b: Scraper) => Number(a.a_scraper) - Number(b.a_scraper),
      render: (value: boolean) => (value ? 'Oui' : 'Non'),
    },
    {
      title: 'Actif',
      dataIndex: 'active',
      key: 'active',
      sorter: (a: Scraper, b: Scraper) => Number(a.active) - Number(b.active),
      render: (value: boolean) => (value ? 'Oui' : 'Non'),
    },
    {
      title: 'Dernier run',
      dataIndex: 'last_run',
      key: 'last_run',
      width: 150,
      sorter: (a: Scraper, b: Scraper) => dayjs(a.last_run ?? '1970-01-01').valueOf() - dayjs(b.last_run ?? '1970-01-01').valueOf(),
      render: (value: string | null) => formatLastRun(value),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Scraper) => (
        <Space>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => void handleScrape(record.id)} title="Scrape" />
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)} title="Voir" />
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, `scraper_${record.id}`)}
            title="Télécharger"
          />
        </Space>
      ),
    },
  ];

  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">Liste des boutiques</h1>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? <p className="loading-text">Chargement…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <>
            <div className="mb-4">
              <Input
                placeholder="Rechercher par nom de boutique..."
                value={boutiqueFilter}
                onChange={(e) => setBoutiqueFilter(e.target.value)}
                allowClear
              />
            </div>
            <Table dataSource={filteredItems} columns={columns} rowKey="id" pagination={false} />
          </>
        ) : null}
      </section>
    </main>
  );
}
