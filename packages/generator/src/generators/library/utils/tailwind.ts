import { Tree, logger, readProjectConfiguration } from '@nx/devkit';
import * as path from 'path';

export function patchTailwindImport(tree: Tree, projectName: string): void {
  try {
    const projectConfig = readProjectConfiguration(tree, projectName);
    const projectRoot = projectConfig.root;
    
    // Look for CSS/SCSS files with Tailwind import
    const possibleStyleFiles = [
      path.join(projectRoot, 'src/styles.css'),
      path.join(projectRoot, 'src/styles.scss'),
      path.join(projectRoot, 'src/style.css'),
      path.join(projectRoot, 'src/style.scss'),
    ];
    
    for (const styleFile of possibleStyleFiles) {
      if (tree.exists(styleFile)) {
        const content = tree.read(styleFile)?.toString('utf-8');
        if (content && content.includes("@import 'tailwindcss'")) {
          const updatedContent = content.replace(
            /@import 'tailwindcss';/g,
            "@import 'tailwindcss' source(none);\n@source '../../../{apps,libs}/**/*.{html,css,js,ts,jsx,tsx}';"
          );
          tree.write(styleFile, updatedContent);
          logger.info(`Patched Tailwind import in ${styleFile}`);
          return; // Only patch the first file found
        }
      }
    }
    
    logger.warn(
      `Could not find a style file with Tailwind import in project '${projectName}'. Skipping Tailwind patch.`
    );
  } catch (e) {
    logger.error(
      `Error patching Tailwind import for project '${projectName}': ${e}`
    );
  }
}
