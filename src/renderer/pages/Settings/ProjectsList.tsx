import React from 'react';
import {
  Container,
  Box,
  Button,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  Paper,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { API } from '../../services/api.js';

export default function ProjectsList({ projectsList, getProjectsList, logMessage }) {
  const { t } = useTranslation();
  const [projectUrl, setProjectUrl] = React.useState('');

  const onClickRemoveProject = (project) => {
    API.removeProject(project).then((msg) => {
      if (msg) {
        logMessage(`${t('settings.projects.remove-failure')}: ${msg}`, 'error');
      } else {
        getProjectsList();
      }
    });
  };

  const onClickAddProject = () => {
    API.addProject(projectUrl).then((msg) => {
      if (!msg) {
        // success
        getProjectsList();
        setProjectUrl('');
      } else {
        logMessage(`${t('settings.projects.add-failure')}: ${msg}`, 'error');
      }
    });
  };

  const onKeyDownUrl = (e) => {
    if (e.key === 'Enter') {
      onClickAddProject();
    }
  };

  return (
    <Box>
      {projectsList.map((project, index) => {
        if (project.name === 'All' || project.url === undefined) return null;
        return (
          <Paper key={index} sx={{ p: 1, px: 2, mb: 1, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6">{project.name || t('settings.projects.unnamed')}</Typography>
              <Typography variant="body2">{project.url}</Typography>
            </Box>
            <IconButton sx={{ ml: 'auto' }} onClick={() => onClickRemoveProject(project)}>
              <DeleteIcon />
            </IconButton>
          </Paper>
        );
      })}

      <TextField
        label={t('settings.projects.url')}
        fullWidth
        size="small"
        value={projectUrl}
        onChange={(e) => setProjectUrl(e.target.value)}
        onKeyDown={onKeyDownUrl}
      />

      <Button variant="contained" disabled={!projectUrl} onClick={onClickAddProject}>
        {t('settings.projects.add')}
      </Button>
    </Box>
  );
}
