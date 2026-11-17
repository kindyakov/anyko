'use client';
import { Menu } from '@base-ui/react/menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';

import type { Membership } from '@anyko/contracts/session';

import { routes } from '@/lib/routes';

// Одно участие — только имя области. Несколько — меню со ссылками на области; текущая отмечена.
export function WorkspaceSwitcher({
  memberships,
  current,
}: {
  memberships: readonly Membership[];
  current: Membership;
}) {
  const name = current.workspace.name;
  if (memberships.length < 2)
    return <p className="text-muted truncate text-[11px]">{name}</p>;
  return (
    <Menu.Root>
      <Menu.Trigger className="text-muted hover:text-ink focus-visible:outline-brand-hot inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="truncate">{name}</span>
        <ChevronsUpDown size={12} aria-hidden className="shrink-0" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="start">
          <Menu.Popup className="glass z-50 min-w-56 rounded-2xl border border-white/10 p-1.5 shadow-xl outline-none">
            <Menu.Group>
              <Menu.GroupLabel className="text-muted px-2.5 py-1.5 text-xs">
                Рабочие области
              </Menu.GroupLabel>
              {memberships.map(({ workspace }) => {
                const selected = workspace.id === current.workspace.id;
                return (
                  <Menu.LinkItem
                    key={workspace.id}
                    render={<Link href={routes.works(workspace.id)} />}
                    aria-current={selected ? 'true' : undefined}
                    className="text-ink flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-white/[0.06]"
                  >
                    <span className="truncate">{workspace.name}</span>
                    {selected && (
                      <Check size={14} aria-hidden className="text-brand-hot" />
                    )}
                  </Menu.LinkItem>
                );
              })}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
