// renderers.ts
import { materialRenderers } from '@jsonforms/material-renderers';
import { FilePathControl } from './FilePathControl';
import { filePathTester, directoryPathTester } from './filePath.tester';
import {
  EnumArrayControl,
  EnumControl,
  OneOfEnumControl,
  enumArrayControlTester,
  enumControlTester,
  oneOfEnumControlTester
} from './EnumControls';
import VerticalCategorization, {
  verticalCategorizationTester
} from './VerticalCategorizationRenderer';

export const renderers = [
  ...materialRenderers,
  { tester: filePathTester, renderer: FilePathControl },
  { tester: directoryPathTester, renderer: FilePathControl },
  { tester: verticalCategorizationTester, renderer: VerticalCategorization },
  // Enum options whose value is the empty string need a visible label in the
  // dropdown; the stock renderers collapse the row to nothing.
  { tester: enumControlTester, renderer: EnumControl },
  { tester: oneOfEnumControlTester, renderer: OneOfEnumControl },
  { tester: enumArrayControlTester, renderer: EnumArrayControl }
];
