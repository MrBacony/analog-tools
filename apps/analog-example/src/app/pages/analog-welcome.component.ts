import { Component, computed, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { shareReplay, Subject, switchMap, take } from 'rxjs';
import { waitFor } from '@analogjs/trpc';
import { injectTrpcClient } from '../../trpc-client';
import { Note } from '../../note';
import { AuthService } from '@analog-tools/auth/angular';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'analog-example-analog-welcome',

  imports: [AsyncPipe, FormsModule, DatePipe, RouterLink],
  host: {
    class:
      'flex min-h-screen flex-col text-zinc-900 bg-zinc-50 px-4 pt-8 pb-32',
  },
  template: `
    <main class="flex-1 mx-auto">
      <section class="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
        <div class="flex max-w-[64rem] flex-col items-center gap-4 text-center">
          <a routerLink="/test">Go to Test Page</a>
          <img
            class="h-12 w-12"
            src="https://analogjs.org/img/logos/analog-logo.svg"
            alt="AnalogJs logo. Two red triangles and a white analog wave in front"
            />
          <a
            class="rounded-2xl bg-zinc-200 px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            target="_blank"
            href="https://twitter.com/analogjs"
            >Follow along on Twitter</a
            >
            <div>Is Logged in: {{ isAuth() }} | {{ jsonUser() }}</div>
            <h1
              class="font-heading font-medium text-3xl sm:text-5xl md:text-6xl lg:text-7xl"
              >
              <span class="text-[#DD0031]">Analog.</span> The fullstack Angular
              meta-framework
            </h1>
            <p
              class="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8"
              >
              Analog is for building applications and websites with Angular.
              <br />Powered by Vite.
            </p>
            <div class="space-x-4">
              <a
                class="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-zinc-950 text-zinc-50 hover:bg-zinc-950/90 h-11 px-8 rounded-md"
                href="https://analogjs.org"
                >Read the docs</a
                ><a
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-zinc-100 hover:text-zinc-950 h-11 px-8 rounded-md"
                href="https://github.com/analogjs/analog"
                >Star on GitHub</a
                >
              </div>
            </div>
          </section>
          <section id="trpc-demo" class="py-8 md:py-12 lg:py-24">
            <div
              class="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center"
              >
              <h2 class="text-[#DD0031] font-medium text-3xl leading-[1.1]">
                Leave a note
              </h2>
              <p class="max-w-[85%] leading-normal sm:text-lg sm:leading-7">
                This is an example of how you can use tRPC to superpower your
                client-server interaction.
              </p>
            </div>
            <form
              class="mt-8 pb-2 flex items-center"
              #f="ngForm"
              (ngSubmit)="addNote(f)"
              >
              <label class="sr-only" for="newNote"> Note </label>
              <input
                required
                autocomplete="off"
                name="newNote"
                [(ngModel)]="newNote"
                class="w-full inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:text-zinc-950 h-11 px-2 rounded-md"
                />
              <button
                class="ml-2 inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-zinc-100 hover:text-zinc-950 h-11 px-8 rounded-md"
                >
                +
              </button>
            </form>
            @if (notes$ | async; as notes) {
              <div class="mt-4">
                @for (note of notes; track noteTrackBy(i, note); let i = $index) {
                  <div
                    class="note mb-4 p-4 font-normal border border-input rounded-md"
                    >
                    <div class="flex items-center justify-between">
                      <p class="text-sm text-zinc-400">{{ note.createdAt | date }}</p>
                      <button
                        [attr.data-testid]="'removeNoteAtIndexBtn' + i"
                        class="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-zinc-100 hover:text-zinc-950 h-6 w-6 rounded-md"
                        (click)="removeNote(note.id)"
                        >
                        x
                      </button>
                    </div>
                    <p class="mb-4">{{ note.note }}</p>
                  </div>
                }
                @if (notes.length === 0) {
                  <div
                    class="no-notes text-center rounded-xl p-20"
                    >
                    <h3 class="text-xl font-medium">No notes yet!</h3>
                    <p class="text-zinc-400">
                      Add a new one and see them appear here...
                    </p>
                  </div>
                }
              </div>
            } @else {
              <p class="text-center mt-4">Loading...</p>
            }
          </section>
        </main>
    `,
})
export class AnalogWelcomeComponent {
  private _trpc = injectTrpcClient();
  private authClient = inject(AuthService);
  public triggerRefresh$ = new Subject<void>();
  public notes$ = this.triggerRefresh$.pipe(
    switchMap(() => this._trpc.note.list.query()),
    shareReplay(1)
  );
  public newNote = '';

  public isAuth = this.authClient.isAuthenticated;
  public user = this.authClient.user;

  jsonUser = computed(() => {
    const user = this.authClient.userResource.value();
    return user ? JSON.stringify(user, null, 2) : 'No user data available';
  });

  constructor() {
    void waitFor(this.notes$);
    this.triggerRefresh$.next();
  }

  public noteTrackBy = (index: number, note: Note) => {
    return note.id;
  };

  public addNote(form: NgForm) {
    if (!form.valid) {
      form.form.markAllAsTouched();
      return;
    }
    this._trpc.note.create
      .mutate({ note: this.newNote })
      .pipe(take(1))
      .subscribe(() => this.triggerRefresh$.next());
    this.newNote = '';
    form.form.reset();
  }

  public removeNote(id: number) {
    this._trpc.note.remove
      .mutate({ id })
      .pipe(take(1))
      .subscribe(() => this.triggerRefresh$.next());
  }
}
