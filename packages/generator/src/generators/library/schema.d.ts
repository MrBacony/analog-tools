export interface LibraryGeneratorSchema {
  name: string;
  project: string;
  trpc?: boolean;
  pages?: boolean;
  contentRoutes?: boolean;
  api?: boolean;
  skipExamples?: boolean;
}
