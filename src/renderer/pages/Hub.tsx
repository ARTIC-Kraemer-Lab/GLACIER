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
  Alert,
  MenuItem
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';

export default function HubPage({
  repoUrl,
  setRepoUrl,
  targetDir,
  drawerOpen,
  setTargetDir,
  setFolderPath,
  allowArbitraryRepoCloning,
  logMessage,
  setView
}) {
  const { t } = useTranslation();

  const [installedRepos, setInstalledRepos] = useState([]);
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState([]);

  const updateInstalledRepos = async () => {
    API.getCollections().then((list) => {
      setInstalledRepos(list);
    });
  };

  const getInstallableRepos = () => {
    API.getInstallableReposList().then((repos) => {
      repos.forEach((repo) => {
        repo.installing = false;
      });
      setRepos(repos);
    });
  };

  useEffect(() => {
    getInstallableRepos();
    updateInstalledRepos();
  }, []);

  const addRepo = (repoUrl: string) => {
    API.addInstallableRepo(repoUrl)
      .then(() => {
        logMessage(t('hub.repo-added'), 'success');
        getInstallableRepos();
      })
      .catch((err) => {
        console.error(err);
        logMessage(`${t('hub.repo-add-failed')}`, 'error');
      });
  };

  const setInstallationState = (repoUrl: string, version: string, installing: boolean) => {
    const newRepos = repos.map((repo) =>
      repo.url === repoUrl && repo.version === version ? { ...repo, installing: installing } : repo
    );
    setRepos(newRepos);
  };

  const cloneRepo = async (repoUrl: string, version: string) => {
    // Clone repository
    setInstallationState(repoUrl, version, true);
    try {
      const result = await API.cloneRepo(repoUrl, version);
      if (result?.path) {
        setTargetDir(result.path);
        setFolderPath(result.path);
        logMessage(`Cloned ${result.name} to ${result.path}`, 'success');
        setView('library');
      } else {
        logMessage(t('hub.clone-return-none'), 'error');
      }
    } catch (err) {
      console.error(err);
      logMessage(t('hub.clone-failed'), 'error');
    }
    setInstallationState(repoUrl, version, false);
    updateInstalledRepos();
  };

  const isRepoInstalled = (repoUrl: string, version: string) => {
    return installedRepos.some((repo) => repo.url === repoUrl && repo.version === version);
  };

  const onChangeRepoVersion = (repo, newVersion) => {
    const updatedRepos = repos.map((r) => (r.url === repo.url ? { ...r, version: newVersion } : r));
    setRepos(updatedRepos);
  };

  return (
    <Container sx={{ pb: 12 }}>
      {' '}
      {/* extra space for fixed log */}
      <Stack spacing={3}>
        {allowArbitraryRepoCloning && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('hub.add-workflow-from-repository')}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography>{t('hub.repo')}:</Typography>
              <TextField
                id="collections-repo-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                size="small"
                fullWidth
              />
              <Button
                id="collections-add-button"
                variant="contained"
                onClick={() => addRepo(repoUrl)}
                size="small"
              >
                {t('hub.add')}
              </Button>
            </Stack>
            {targetDir && (
              <Typography variant="body2" sx={{ mt: 1, color: 'gray' }}>
                {targetDir}
              </Typography>
            )}
          </Paper>
        )}

        {repos.length === 0 ? (
          <Typography variant="h6" sx={{ mt: 2 }}>
            No installable workflows.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {repos.map((repo) => (
              <Grid item xs={12} sm={6} md={4} key={repo.url}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {repo.name}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Select
                      id={`hub-version-select-${repo.name}`}
                      value={repo.version}
                      defaultValue={repo.versions[0]}
                      onChange={(e) => onChangeRepoVersion(repo, e.target.value)}
                      size="small"
                    >
                      {repo.versions.map((version) => (
                        <MenuItem key={version} value={version}>
                          {version}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button
                      id={`hub-install-${repo.name}`}
                      size="small"
                      variant="contained"
                      onClick={() => cloneRepo(repo.url, repo.version)}
                      disabled={isRepoInstalled(repo.url, repo.version) || repo.installing}
                    >
                      {t('hub.install')}
                      {repo.installing && (
                        <CircularProgress
                          size={40}
                          sx={{
                            position: 'absolute',
                            top: '0%',
                            left: '25%',
                            zIndex: 1
                          }}
                        />
                      )}
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Stack>
    </Container>
  );
}
