import React, { useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  Stack,
  MenuItem,
  Paper,
  Tab,
  Tabs
} from '@mui/material';
import ProjectsList from './ProjectsList.js';
import { API } from '../../services/api.js';
import { SettingsKey } from '../../../types/settings.js';
import { useTranslation } from 'react-i18next';

export default function SettingsPage({
  darkMode,
  setDarkMode,
  collectionsPath,
  setCollectionsPath,
  allowArbitraryRepoCloning,
  setAllowArbitraryRepoCloning,
  projectsList,
  getProjectsList,
  logMessage
}) {
  const { t, i18n } = useTranslation();

  const [language, setLanguage] = React.useState(i18n.language || 'en');
  const [tabValue, setTabValue] = React.useState(0);
  const [disableProjects, setDisableProjects] = React.useState(false);
  const [disableSchemaValidation, setDisableSchemaValidation] = React.useState(false);

  const handlePathChange = (e) => {
    const newPath = e.target.value;
    setCollectionsPath(newPath);
    API.setCollectionsPath(newPath).then(() => {
      console.log('Collections path updated to', newPath);
    });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  const handleDisableProjects = (value) => {
    setDisableProjects(value);
    API.settingsSet(SettingsKey.DisableProjects, value);
  };

  const handleDisableSchemaValidation = (value) => {
    setDisableSchemaValidation(value);
    API.settingsSet(SettingsKey.DisableSchemaValidation, value);
  };

  useEffect(() => {
    API.settingsGet(SettingsKey.DisableSchemaValidation).then((value) => {
      setDisableSchemaValidation(value);
    });
    API.settingsGet(SettingsKey.DisableProjects).then((value) => {
      setDisableProjects(value);
    });
  }, []);

  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;
    return (
      <Box
        role="tabpanel"
        hidden={value !== index}
        id={`vertical-tabpanel-${index}`}
        aria-labelledby={`vertical-tab-${index}`}
        sx={{ width: '100%' }}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3, width: '100%' }}>
            <Typography>{children}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        flexGrow: 1,
        display: 'flex',
        height: '100%'
      }}
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        sx={{ borderRight: 1, borderColor: 'divider' }}
      >
        <Tab id="settings-general-panel" label={t('settings.general')} />
        <Tab
          id="settings-project-panel"
          label={t('settings.project-options')}
          disabled={disableProjects}
        />
        <Tab id="settings-visual-panel" label={t('settings.visual-options')} />
        <Tab id="settings-language-panel" label={t('settings.language-select')} />
        <Tab id="settings-advanced-panel" label={t('settings.advanced-options')} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <TextField
          id="settings-collections-path"
          label={t('settings.collections-path')}
          fullWidth
          value={collectionsPath}
          onChange={handlePathChange}
          sx={{ mt: 2 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={allowArbitraryRepoCloning}
              onChange={() => setAllowArbitraryRepoCloning(!allowArbitraryRepoCloning)}
            />
          }
          label={t('settings.allow-arbitrary-repo-cloning')}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ProjectsList
          projectsList={projectsList}
          getProjectsList={getProjectsList}
          logMessage={logMessage}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <FormControlLabel
          control={<Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />}
          label={t('settings.dark-mode')}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Select
          labelId="settings-language-select-label"
          id="settings-language-select"
          value={language}
          label={t('settings.language-select')}
          onChange={handleLanguageChange}
        >
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="fr">Français</MenuItem>
        </Select>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={disableProjects}
                onChange={() => handleDisableProjects(!disableProjects)}
              />
            }
            label={t('settings.disable-projects')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={disableSchemaValidation}
                onChange={() => handleDisableSchemaValidation(!disableSchemaValidation)}
              />
            }
            label={t('settings.disable-schema-validation')}
          />
        </Stack>
      </TabPanel>
    </Paper>
  );
}
