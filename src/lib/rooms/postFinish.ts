/**
 * What the sheet after a room mission offers, and in what order.
 *
 * The plan's rule: one sheet, one decision. Share, then save the result, with
 * joining the room as a checkbox on the same sheet rather than a third prompt.
 * Three sequential asks at the finish would tank the claim rate, and the claim
 * is what the primary metric is measured on.
 *
 * The checkbox rides two records at once -- membership and attribution -- and
 * unticking it must never block saving. That is the whole reason the save
 * button and the checkbox are separate controls on one sheet.
 */

export interface PostFinishInput {
  /** The room this mission belongs to, or null for a personal mission. */
  room: { handle: string; displayName: string; isMember: boolean; hasHomeCoach: boolean } | null;
  /** Whether the result can still be claimed -- false once it is saved. */
  canSave: boolean;
}

export interface PostFinishSheet {
  /** Nothing to offer; render no sheet at all. */
  show: boolean;
  showSave: boolean;
  showJoin: boolean;
  /** The checkbox starts ticked, per the plan. */
  joinDefault: boolean;
  /** One line saying what the coach can see. Null when there is no checkbox. */
  joinNote: string | null;
}

export function postFinishSheet(input: PostFinishInput): PostFinishSheet {
  const room = input.room;
  // Already a member? Then joining is not a decision to re-offer.
  const showJoin = room !== null && !room.isMember;

  return {
    show: input.canSave || showJoin,
    showSave: input.canSave,
    showJoin,
    joinDefault: showJoin,
    joinNote: showJoin && room ? joinNote(room.displayName, room.hasHomeCoach) : null,
  };
}

/**
 * What ticking the box actually does, said plainly.
 *
 * An athlete who already has a home coach is told their attribution does not
 * move -- before they decide, not after. Silence there would read as "this
 * changes my coach", which is the thing most likely to make them untick it.
 *
 * This used to say only that the coach would see it. Since the room page
 * carries a public activity feed, ticking this also puts the athlete's name on
 * a page anyone can open -- including, retroactively, finishes already on it.
 * A change to a public page has to be consented to rather than discovered, so
 * the note says it before the tick and says the opt-out in the same breath.
 */
export function joinNote(roomName: string, hasHomeCoach: boolean): string {
  const base = `Your name goes on the missions you finish in ${roomName}'s room, on their public page. You can turn that off any time.`;
  return hasHomeCoach
    ? `${base} Your home coach stays who it is today.`
    : `${base} It never adds you to anyone's squad.`;
}

/** The order the sheet renders in. Share first, because it is the thing they want. */
export const POST_FINISH_ORDER = ['share', 'save', 'join'] as const;
