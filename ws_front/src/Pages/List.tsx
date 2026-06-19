import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Table, Button, Space, Input } from 'antd';
import { EyeOutlined, ThunderboltOutlined, SearchOutlined } from '@ant-design/icons';
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
  scrapper_niveau: number | null;
  retrait_db: string | null;
  a_scraper: boolean;
  active: boolean;
  last_run: string | null;
}

const bool = (v: boolean | null) => (v === null ? '-' : v ? 'Oui' : 'Non');
const str = (v: string | null) => v ?? '-';

// Filtre colonne générique
const colSearch = (accessor: (r: Scraper) => unknown) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
    <div className="filter-dropdown">
      <Input
        placeholder="Rechercher"
        value={selectedKeys[0] ?? ''}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm({ closeDropdown: true })}
        className="filter-input"
      />
      <Space>
        <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm({ closeDropdown: true })}>
          OK
        </Button>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.();
            confirm({ closeDropdown: true });
          }}
        >
          Reset
        </Button>
      </Space>
    </div>
  ),
  filterIcon: (filtered: boolean) => <SearchOutlined className={filtered ? 'filter-icon' : ''} />,
  onFilter: (value: any, record: Scraper) => {
    const filterVal = Array.isArray(value) ? value[0] : value;
    return String(accessor(record) ?? '')
      .toLowerCase()
      .includes(String(filterVal ?? '').toLowerCase());
  },
});

export function ListPage() {
  const { items, loading, error, refresh } = useScrappers();
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  const [boutiqueFilter, setBoutiqueFilter] = useState(() => localStorage.getItem('list:boutique-filter') ?? '');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const filteredItems = boutiqueFilter
    ? items.filter((i) => (i.nom_boutique ?? '').toLowerCase().includes(boutiqueFilter.toLowerCase()))
    : items;

  const goEdit = (id: string | number) => navigate({ to: '/edit', search: { id } });
  const goView = (id: string | number) => window.open(`${apiBase}/scrap/${id}/view`, '_blank');
  const goScrape = async (id: string | number) => {
    await fetch(`${apiBase}/scrap/${id}/run`);
    await refresh();
  };

  const clickable = (id: string | number, label: React.ReactNode) => (
    <span onClick={() => goEdit(id)} className="table-id-text">
      {label}
    </span>
  );

  const columns: any[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      className: 'table-id-col',
      sorter: (a: Scraper, b: Scraper) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
      ...colSearch((r) => r.id),
      render: (v: string | number) => clickable(v, v),
    },
    {
      title: 'Boutique',
      key: 'boutique',
      sorter: (a: Scraper, b: Scraper) => (a.nom_boutique ?? '').localeCompare(b.nom_boutique ?? '', 'fr'),
      render: (_: unknown, r: Scraper) => clickable(r.id, r.nom_boutique ?? '--'),
    },
    {
      title: 'Nivo',
      dataIndex: 'niveau',
      key: 'id',
      sorter: (a: Scraper, b: Scraper) => {
        const na = Number(a.niveau);
        const nb = Number(b.niveau);
        const va = Number.isFinite(na) ? na : -Infinity;
        const vb = Number.isFinite(nb) ? nb : -Infinity;
        return va - vb;
      },
      ...colSearch((r: Scraper) => (r.niveau == null ? '' : String(r.niveau))),
      render: (v: number | null) => (v == null ? '-' : String(v)),
    },
    {
      title: 'Nivo2',
      dataIndex: 'scrapper_niveau',
      key: 'scrapper_niveau',
      sorter: (a: Scraper, b: Scraper) => {
        const na = Number(a.scrapper_niveau);
        const nb = Number(b.scrapper_niveau);
        const va = Number.isFinite(na) ? na : -Infinity;
        const vb = Number.isFinite(nb) ? nb : -Infinity;
        return va - vb;
      },
      ...colSearch((r: Scraper) => (r.scrapper_niveau == null ? '' : String(r.scrapper_niveau))),
      render: (v: number | null) => (v == null ? '-' : String(v)),
    },
    {
      title: 'En retrait',
      dataIndex: 'retrait_db',
      key: 'retrait_db',
      sorter: (a: Scraper, b: Scraper) => Number(a.retrait_db ?? -1) - Number(b.retrait_db ?? -1),
    },
    {
      title: 'Payant',
      dataIndex: 'payant',
      key: 'payant',
      sorter: (a: Scraper, b: Scraper) => Number(a.payant ?? -1) - Number(b.payant ?? -1),
      render: bool,
    },
    {
      title: 'Retrait',
      dataIndex: 'retrait',
      key: 'retrait',
      sorter: (a: Scraper, b: Scraper) => Number(a.retrait ?? -1) - Number(b.retrait ?? -1),
      render: bool,
    },
    {
      title: 'Cat',
      dataIndex: 'thecat',
      key: 'thecat',
      sorter: (a: Scraper, b: Scraper) => (a.thecat ?? '').localeCompare(b.thecat ?? '', 'fr'),
      ...colSearch((r) => r.thecat ?? ''),
      render: str,
    },
    {
      title: 'Scrap',
      dataIndex: 'a_scraper',
      key: 'a_scraper',
      sorter: (a: Scraper, b: Scraper) => Number(a.a_scraper) - Number(b.a_scraper),
      render: bool,
    },
    {
      title: 'Actif',
      dataIndex: 'active',
      key: 'active',
      sorter: (a: Scraper, b: Scraper) => Number(a.active) - Number(b.active),
      render: bool,
    },
    {
      title: 'Dernier run',
      dataIndex: 'last_run',
      key: 'last_run',
      width: 150,
      sorter: (a: Scraper, b: Scraper) => dayjs(a.last_run ?? '1970').valueOf() - dayjs(b.last_run ?? '1970').valueOf(),
      render: (v: string | null) => {
        if (!v) {
          return { props: { style: { backgroundColor: '#000', color: '#fff' } }, children: '-' };
        }

        const diffSec = dayjs().diff(dayjs(v), 'second');
        let bg = '#5e1717';
        let color = '#fff';

        if (diffSec >= 1500000000) {
          bg = '#000';
          color = '#fff';
        } else if (diffSec <= 3600) {
          bg = '#74d99f';
          color = '#000';
        } else if (diffSec <= 3 * 3600) {
          bg = '#a8eec1';
          color = '#000';
        } else if (diffSec <= 6 * 3600) {
          bg = '#e3fcec';
          color = '#000';
        } else if (diffSec <= 24 * 3600) {
          bg = '#fff';
          color = '#000';
        } else if (diffSec <= 2 * 86400) {
          bg = '#fce8e8';
          color = '#000';
        } else if (diffSec <= 3 * 86400) {
          bg = '#f4aaaa';
          color = '#000';
        } else if (diffSec <= 7 * 86400) {
          bg = '#eb8484';
          color = '#000';
        } else if (diffSec <= 30 * 86400) {
          bg = '#e36363';
          color = '#000';
        }

        const text = isHydrated ? dayjs(v).fromNow() : dayjs(v).format('YYYY-MM-DD HH:mm');

        return {
          props: { style: { backgroundColor: bg, color } },
          children: text,
        };
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: Scraper) => (
        <Space>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => void goScrape(r.id)} title="Scrape" />
          <Button size="small" icon={<EyeOutlined />} onClick={() => goView(r.id)} title="Voir" />
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

        {loading && <p className="loading-text">Chargement…</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && !error && (
          <>
            <div className="mb-4">
              <Input
                placeholder="Rechercher par nom de boutique..."
                value={boutiqueFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setBoutiqueFilter(v);
                  if (v) localStorage.setItem('list:boutique-filter', v);
                  else localStorage.removeItem('list:boutique-filter');
                }}
                allowClear
              />
            </div>
            <Table dataSource={filteredItems} columns={columns} rowKey="id" pagination={false} />
          </>
        )}
      </section>
    </main>
  );
}
