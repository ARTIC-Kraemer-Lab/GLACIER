// renderers.ts
import { materialRenderers } from '@jsonforms/material-renderers';
import { FilePathControl } from './FilePathControl';
import { filePathTester, directoryPathTester } from './filePath.tester';
import VerticalCategorization, {
  verticalCategorizationTester
} from './VerticalCategorizationRenderer';

export const renderers = [
  ...materialRenderers,
  { tester: filePathTester, renderer: FilePathControl },
  { tester: directoryPathTester, renderer: FilePathControl },
  { tester: verticalCategorizationTester, renderer: VerticalCategorization }
];
