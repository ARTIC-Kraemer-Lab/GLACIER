import React from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function TestLaunchDialog({ allProfiles, onLaunch }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(
    allProfiles.includes('docker') ? ['docker'] : []
  );

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelected(event.target.value as string[]);
  };

  const handleLaunch = () => {
    onLaunch(['test', ...selected]);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outlined" onClick={handleOpen}>
        {t('parameters.test-launch-dropdown')}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        aria-labelledby="test-launch-dialog-title"
      >
        <DialogTitle id="test-launch-dialog-title">{t('parameters.test-launch-title')}</DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            {t('parameters.test-launch-instructions') || ''}
          </Typography>

          <FormControl sx={{ mt: 1, width: '100%' }}>
            <InputLabel id="parameters-additional-test-profiles-label">
              {t('parameters.additional-test-profiles')}
            </InputLabel>

            <Select
              labelId="parameters-additional-test-profiles-label"
              id="parameters-additional-test-profiles"
              multiple
              value={selected}
              onChange={handleChange}
              input={
                <OutlinedInput
                  id="select-additional-test-profiles"
                  label={t('parameters.additional-test-profiles')}
                />
              }
              MenuProps={{
                disablePortal: true,
                PaperProps: {
                  sx: {
                    minWidth: '100%',
                    maxHeight: 300
                  }
                }
              }}
              renderValue={(selectedValue) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selectedValue as string[]).map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
            >
              {allProfiles
                .filter((name) => name !== 'test')
                .map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel') || 'Cancel'}</Button>
          <Button variant="contained" onClick={handleLaunch}>
            {t('parameters.test-launch-workflow') || 'Launch Workflow'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
