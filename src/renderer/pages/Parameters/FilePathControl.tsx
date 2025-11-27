// FilePathControl.tsx
import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, isDescriptionHidden } from '@jsonforms/core';
import { TextField, IconButton, Stack } from '@mui/material';
import { Box } from '@mui/system';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const toFilters = (accept?: string): Electron.FileFilter[] | undefined => {
  // accept like ".csv,.fastq,.fastq.gz,application/json"
  if (!accept) return undefined;
  const exts = accept
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!exts.length) return undefined;
  return [
    {
      name: 'Accepted',
      extensions: exts
        .map((e) => (e.startsWith('.') ? e.slice(1) : e)) // ".csv" -> "csv"
        .filter((e) => !e.includes('/')) // drop MIME types
    }
  ];
};

function InnerFilePathControl(props: ControlProps) {
  const {
    data,
    handleChange,
    path,
    label,
    required,
    visible = true,
    enabled = true,
    id,
    config,
    uischema,
    schema,
    errors
  } = props;

  if (!visible) return null;

  const description =
    (uischema as any)?.options?.description ?? schema?.description ?? (schema as any)?.help_text;

  const showDesc = !isDescriptionHidden(visible, description, config);
  const isDirectory = schema?.format === 'directory-path';
  const accept = (uischema as any)?.options?.accept as string | undefined;

  const pick = async () => {
    const filters = isDirectory ? undefined : toFilters(accept);
    const picked = isDirectory
      ? await window.electronAPI.pickDirectory()
      : await window.electronAPI.pickFile(filters);
    if (picked) handleChange(path, picked); // <-- store the OS path string
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ opacity: enabled ? 1 : 0.6 }}
      alignItems="flex-start" // top-align the children
    >
      {/* Left: field + helper text */}
      <Box sx={{ flexGrow: 1 }}>
        <TextField
          id={id}
          label={label}
          value={data ?? ''}
          required={required}
          InputProps={{ readOnly: true }}
          disabled={!enabled}
          error={Boolean(errors)}
          helperText={errors || (showDesc ? description : undefined)}
          size="small"
          fullWidth
        />
      </Box>

      {/* Right: icon, top-aligned with the field */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <IconButton onClick={pick} disabled={!enabled}>
          {isDirectory ? <FolderOpenIcon /> : <FileOpenIcon />}
        </IconButton>
      </Box>
    </Stack>
  );
}

export const FilePathControl = withJsonFormsControlProps(InnerFilePathControl);
