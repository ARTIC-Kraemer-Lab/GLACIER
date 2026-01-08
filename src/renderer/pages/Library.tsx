import React, { useEffect, useState } from 'react';
import {
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Box,
  Grid,
  Select,
  Snackbar,
  MenuItem,
  Alert,
  Link
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { API } from '../services/api.js';

export default function LibraryPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  drawerOpen,
  setTargetDir,
  setFolderPath,
  addToInstancesList,
  logMessage,
  setView
}) {
  const { t } = useTranslation();

  const [repos, setRepos] = useState([]);
  const [open, setOpen] = useState(false);

  const getRepos = async () => {
    const list = await API.getCollections();
    const enriched = await Promise.all(
      list.map(async (repo) => {
        const info = await API.getWorkflowInformation(repo);
        return {
          ...repo,
          info: {
            ...(repo.info ?? {}),
            title: info.title || repo.name,
            description: info.description || ''
          }
        };
      })
    );
    setRepos(enriched);
  };

  useEffect(() => {
    getRepos();
  }, []);

  const onClickSync = async (repo) => {
    try {
      const result = await API.syncRepo(repo.path);
      if (result?.status === 'ok') {
        logMessage(t('library.repo-sync-success'), 'success');
      } else {
        throw new Error(result?.message || t('library.repo-sync-failed'));
      }
    } catch (err) {
      console.error(err);
      logMessage(t('library.repo-sync-failed'), 'error');
    }
  };

  if (repos.length === 0) {
    return (
      <Container>
        <Typography variant="h6" sx={{ mt: 2 }}>
          No workflows in library. You can install workflows through the{' '}
          <Link component="button" underline="hover" onClick={() => setView('hub')}>
            Hub
          </Link>
          .
        </Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ pb: 12 }}>
      {' '}
      {/* extra space for fixed log */}
      <Stack spacing={3}>
        <Grid container spacing={2}>
          {repos.map((repo) => (
            /* @ts-ignore */
            <Grid item xs={12} sm={6} md={4} key={repo.path}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h5">{repo.info.title}</Typography>
                <Typography variant="subtitle1">
                  {repo.name} @ {repo.version}
                </Typography>
                <Typography variant="caption">{repo.info.description}</Typography>
                <Box sx={{ height: 8 }} />
                <Stack direction="row" spacing={1}>
                  <Button
                    id={`collections-run-${repo.name}`}
                    size="small"
                    variant="contained"
                    onClick={() => addToInstancesList(repo)}
                  >
                    {t('library.run')}
                  </Button>
                  <Button
                    id={`collections-sync-${repo.name}`}
                    size="small"
                    variant="outlined"
                    onClick={() => onClickSync(repo)}
                  >
                    {t('library.sync')}
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
