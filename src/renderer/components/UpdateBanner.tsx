import React, { useEffect, useState } from 'react';
import { Alert, Button, IconButton, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { API } from '../services/api.js';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

/**
 * Check for a newer GLACIER release on launch and offer a link to the release
 * notes. Dismissing hides the banner until the next launch: the reminder
 * returns on every run until the user upgrades.
 */
export default function UpdateBanner() {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await API.checkForUpdate();
        if (cancelled || !result?.ok || !result.data) return;
        setUpdate(result.data);
      } catch {
        // Tracking updates must never interfere with startup.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || dismissed) return null;

  return (
    <Alert
      id="update-available-banner"
      severity="info"
      sx={{ borderRadius: 0 }}
      action={
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            color="inherit"
            size="small"
            component="a"
            href={update.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('updates.download-update')}
          </Button>
          <IconButton
            size="small"
            color="inherit"
            aria-label={t('common.close')}
            onClick={() => setDismissed(true)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      {t('updates.available', {
        version: update.latestVersion,
        current: update.currentVersion
      })}
    </Alert>
  );
}
