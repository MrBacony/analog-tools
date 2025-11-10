export interface LibraryGeneratorSchema {
  name: string;
  project: string;
  pages?: boolean;
  api?: boolean;
  contentRoutes?: boolean;
  trpc?: boolean;
  skipExamples?: boolean;
  componentPrefix?: string;
}
