import React from 'react';
import {
  Container,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  Paper
} from '@mui/material';
import { API } from '../services/api.js';
import { useTranslation } from 'react-i18next';

export default function SettingsPage({
  darkMode,
  setDarkMode,
  collectionsPath,
  setCollectionsPath,
  allowArbitraryRepoCloning,
  setAllowArbitraryRepoCloning,
  refreshInstancesList
}) {
  const { t, i18n } = useTranslation();

  const [language, setLanguage] = React.useState(i18n.language || 'en');

  const handlePathChange = (e) => {
    const newPath = e.target.value;
    setCollectionsPath(newPath);
    API.setCollectionsPath(newPath).then(() => {
      refreshInstancesList();
    });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <Container>
      <Typography variant="h6" gutterBottom>
        {t('settings.title')}
      </Typography>

      <TextField
        id="settings-collections-path"
        label={t('settings.collections-path')}
        fullWidth
        value={collectionsPath}
        onChange={handlePathChange}
        sx={{ mt: 2 }}
      />

      <Paper variant="outlined" sx={{ p: 2, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t('settings.project-options')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={allowArbitraryRepoCloning}
              onChange={() => setAllowArbitraryRepoCloning(!allowArbitraryRepoCloning)}
            />
          }
          label={t('settings.allow-arbitrary-repo-cloning')}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t('settings.visual-options')}
        </Typography>
        <FormControlLabel
          control={<Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />}
          label={t('settings.dark-mode')}
        />
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        {t('settings.language-select')}
      </Typography>

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

    </Container>
  );
}
