import { useState } from 'react';
import { BrandEditor } from '@/components/rooms/BrandEditor';
import { roomInviteUrl } from '@/lib/rooms/roomInvite';
import { capabilitiesFor } from '@/lib/rooms/membership';
import type { RoomMember, RoomPage } from '@/lib/api/rooms';

interface RoomTabProps {
  room: RoomPage;
  members: RoomMember[];
  onToggleCohost: (member: RoomMember) => void;
  onSaved: () => void;
}

/**
 * The room itself: who can find it, who is in it, what it looks like.
 *
 * The capability gates stay per-section rather than hiding the whole tab from a
 * co-host. A co-host legitimately needs the invite link and the roster; what
 * they cannot do is change the brand or appoint another co-host, and those are
 * the sections that disappear.
 */
export function RoomTab({ room, members, onToggleCohost, onSaved }: RoomTabProps) {
  const [copied, setCopied] = useState(false);
  const invite = roomInviteUrl(window.location.origin, room.handle);
  const { manageCohosts, editIdentity } = capabilitiesFor(room.myRole);

  return (
    <>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Invite</h2>
        <p className="text-secondary">
          Share this anywhere. Anyone can open it; joining is their choice at the finish.
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-xs">{invite}</code>
          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(invite).then(
                () => setCopied(true),
                () => setCopied(false)
              );
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="eyebrow text-secondary">Athletes ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-secondary">Nobody has joined yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {member.nickname ?? 'Athlete'}
                  {member.role !== 'member' ? (
                    <span className="ml-2 text-xs uppercase text-secondary">{member.role}</span>
                  ) : null}
                </span>
                {manageCohosts && member.role !== 'owner' ? (
                  <button
                    type="button"
                    className="btn-outline shrink-0 text-xs"
                    onClick={() => onToggleCohost(member)}
                  >
                    {member.role === 'cohost' ? 'Remove co-host' : 'Make co-host'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {manageCohosts ? (
          <p className="text-xs text-secondary">
            Co-hosts can publish and run missions. They can&rsquo;t change billing or see earnings.
          </p>
        ) : null}
      </section>

      {editIdentity ? (
        <section className="card space-y-2 p-4 text-sm">
          <h2 className="eyebrow text-secondary">Your colour</h2>
          <p className="text-secondary">
            Athletes&rsquo; share cards from your missions carry your colour and your handle.
          </p>
          <BrandEditor
            roomId={room.id}
            handle={room.handle}
            current={room.brand}
            onSaved={onSaved}
          />
        </section>
      ) : null}
    </>
  );
}
