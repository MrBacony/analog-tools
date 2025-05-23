import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { Note } from '../../../note';

let noteId = 0;
const notes: Note[] = [];
export const noteRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        note: z.string(),
      })
    )
    .mutation(({ input }) =>
      notes.push({
        id: noteId++,
        note: input.note,
        createdAt: new Date().toISOString(),
      })
    ),
  list: protectedProcedure.query(() => notes),
  remove: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(({ input }) => {
      const index = notes.findIndex((note) => input.id === note.id);
      notes.splice(index, 1);
    }),
});
