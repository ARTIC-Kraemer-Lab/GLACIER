import React, { useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DoneIcon from '@mui/icons-material/Done';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AnsiLog from './AnsiLog.js';
import HtmlReports from './HtmlReports.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import HeaderMenu from './HeaderMenu';
import ProgressTracker from './ProgressTracker';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <Box role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} {...other}>
      {value === index && <Box>{children}</Box>}
    </Box>
  );
}

const SECOND = 1000;

export default function LogsPage({ instance, stdOut, stdErr, nextflowLog, logMessage }) {
  const { t } = useTranslation();

  const [nextflowProgress, setNextflowProgress] = React.useState('');
  const [tabSelected, setTabSelected] = React.useState(0);
  const [workflowStatus, setWorkflowStatus] = React.useState('unknown');

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  return (
    <Paper>
      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label={t('monitor.logs.stdout')} />
        <Tab label={t('monitor.logs.stderr')} />
        <Tab label={t('monitor.logs.nextflow-log')} />
      </Tabs>
      <TabPanel value={tabSelected} index={0}>
        <AnsiLog text={stdOut} />
      </TabPanel>
      <TabPanel value={tabSelected} index={1}>
        <AnsiLog text={stdErr} />
      </TabPanel>
      <TabPanel value={tabSelected} index={2}>
        <AnsiLog text={nextflowLog} />
      </TabPanel>
    </Paper>
  );
}
