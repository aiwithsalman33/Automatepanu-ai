'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FEATURE_SLUGS,
  RESOURCES,
  SOLUTION_SLUGS,
} from '@/content/marketing/nav';
import { TOOLS, toolHref } from '@/content/marketing/tools';
import { Logo } from './logo';
import { appUrl, mkButtonClass } from './primitives';

type MenuId = 'product' | 'solutions' | 'resources' | 'tools';

interface MenuItem {
  href: string;
  title: string;
  desc?: string;
}

function useMenus() {
  const t = useTranslations('Marketing');
  const menus: {
    id: MenuId;
    label: string;
    items: MenuItem[];
    footer?: MenuItem;
  }[] = [
    {
      id: 'product',
      label: t('nav.product'),
      items: FEATURE_SLUGS.map((s) => ({
        href: `/features/${s}`,
        title: t(`nav.features.${s}.title`),
        desc: t(`nav.features.${s}.desc`),
      })),
    },
    {
      id: 'solutions',
      label: t('nav.solutions'),
      items: SOLUTION_SLUGS.map((s) => ({
        href: `/solutions/${s}`,
        title: t(`nav.solutionItems.${s}.title`),
        desc: t(`nav.solutionItems.${s}.desc`),
      })),
    },
    {
      id: 'resources',
      label: t('nav.resources'),
      items: RESOURCES.map((r) => ({
        href: r.href,
        title: t(`nav.resourceItems.${r.key}`),
      })),
    },
    {
      id: 'tools',
      label: t('nav.freeTools'),
      items: TOOLS.map((tool) => ({
        href: toolHref(tool.slug),
        title: t(`tools.items.${tool.key}.name`),
        desc: t(`tools.items.${tool.key}.desc`),
      })),
      footer: { href: '/tools', title: t('nav.allTools') },
    },
  ];
  return { t, menus };
}

export function Navbar() {
  const { t, menus } = useMenus();
  const [open, setOpen] = useState<MenuId | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdowns on Escape / outside click; close drawer on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setDrawer(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node))
        setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  return (
    <header
      ref={navRef}
      className={cn(
        'sticky top-0 z-50 border-b transition-colors',
        scrolled
          ? 'border-mk-border bg-white/90 backdrop-blur'
          : 'border-transparent bg-white'
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          aria-label={t('nav.home')}
          className="shrink-0 rounded-lg"
        >
          <Logo />
        </Link>

        {/* Desktop */}
        <ul className="hidden flex-1 items-center gap-1 lg:flex">
          {menus.map((m) => (
            <li key={m.id} className="relative">
              <button
                type="button"
                aria-expanded={open === m.id}
                aria-controls={`mk-menu-${m.id}`}
                onClick={() => setOpen(open === m.id ? null : m.id)}
                className="text-mk-heading hover:bg-mk-soft hover:text-mk-primary-hover inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium"
              >
                {m.label}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'h-4 w-4 transition-transform',
                    open === m.id && 'rotate-180'
                  )}
                />
              </button>
              {open === m.id && (
                <div
                  id={`mk-menu-${m.id}`}
                  className="border-mk-border shadow-mk-lg absolute top-full left-0 mt-2 w-[22rem] rounded-2xl border bg-white p-2"
                >
                  <ul>
                    {m.items.map((item) => (
                      <li key={item.href + item.title}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(null)}
                          className="hover:bg-mk-bg-alt block rounded-xl px-3 py-2.5"
                        >
                          <span className="text-mk-heading block text-sm font-semibold">
                            {item.title}
                          </span>
                          {item.desc && (
                            <span className="text-mk-muted block text-sm">
                              {item.desc}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {m.footer && (
                    <Link
                      href={m.footer.href}
                      onClick={() => setOpen(null)}
                      className="bg-mk-bg-alt2 text-mk-primary-hover hover:bg-mk-soft mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold"
                    >
                      {m.footer.title} →
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <a href={appUrl('/login')} className={mkButtonClass('ghost', 'sm')}>
            {t('nav.signIn')}
          </a>
          <a
            href={appUrl('/signup')}
            className={mkButtonClass('primary', 'sm')}
          >
            {t('nav.startFree')}
          </a>
        </div>

        {/* Mobile */}
        <button
          type="button"
          className="text-mk-heading hover:bg-mk-soft ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
          aria-expanded={drawer}
          aria-controls="mk-drawer"
          aria-label={drawer ? t('nav.closeMenu') : t('nav.openMenu')}
          onClick={() => setDrawer(!drawer)}
        >
          {drawer ? (
            <X aria-hidden className="h-5 w-5" />
          ) : (
            <Menu aria-hidden className="h-5 w-5" />
          )}
        </button>
      </nav>

      {drawer && (
        <div
          id="mk-drawer"
          className="border-mk-border max-h-[calc(100dvh-4rem)] overflow-y-auto border-t bg-white lg:hidden"
        >
          <div className="space-y-1 px-4 py-4">
            {menus.map((m) => (
              <details key={m.id} className="group rounded-xl">
                <summary className="text-mk-heading hover:bg-mk-bg-alt flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 font-semibold">
                  {m.label}
                  <ChevronDown
                    aria-hidden
                    className="h-4 w-4 transition-transform group-open:rotate-180"
                  />
                </summary>
                <ul className="pb-2 pl-3">
                  {[...m.items, ...(m.footer ? [m.footer] : [])].map((item) => (
                    <li key={item.href + item.title}>
                      <Link
                        href={item.href}
                        onClick={() => setDrawer(false)}
                        className="text-mk-body hover:bg-mk-bg-alt hover:text-mk-heading block rounded-lg px-3 py-2 text-sm"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <div className="grid gap-2 pt-3">
              <a
                href={appUrl('/signup')}
                className={mkButtonClass('primary', 'md')}
              >
                {t('nav.startFree')}
              </a>
              <a
                href={appUrl('/login')}
                className={mkButtonClass('secondary', 'md')}
              >
                {t('nav.signIn')}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
