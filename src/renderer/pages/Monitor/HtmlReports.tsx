import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import IconButton from '@mui/material/IconButton';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import FormControl from '@mui/material/FormControl';
import AnsiLog from './AnsiLog.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import HeaderMenu from './HeaderMenu';
import ProgressTracker from './ProgressTracker';

export default function HtmlReports({ instance }) {
  const { t } = useTranslation();

  const [reportsList, setReportsList] = React.useState<Record<string, string>[]>([]);
  const [selectedReport, setSelectedReport] = React.useState<Record<string, string>>({});

  API.getInstanceReportsList(instance).then((reports) => {
    setReportsList(reports || []);
  });

  const handleReportChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const report = reportsList.find((r) => r.id === event.target.value);
    setSelectedReport(report || {});
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth size="small">
          <Select
            value={selectedReport.name}
            onChange={handleReportChange}
            displayEmpty
            inputProps={{ 'aria-label': t('monitor.select-report') }}
            size={'small'}
          >
            {reportsList.map((report) => (
              <MenuItem key={report.id} value={report.id}>
                {report.name}{' '}
                <Typography variant="caption" sx={{ ml: 1, color: 'gray' }}>
                  ({report.path})
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <iframe
        src={selectedReport.path || ''}
        id="frame"
        width="100%"
        height="600"
        sandbox="allow-scripts allow-forms"
      ></iframe>
    </Box>
  );
}
